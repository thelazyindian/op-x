// Twitter Feed Filter - Content Script

class TwitterFeedFilter {
    constructor() {
        this.filters = [];
        this.hiddenCount = 0;
        this.isRunning = false;
        this.observer = null;
        this.init();
    }

    async init() {
        console.log('🐦 Twitter Feed Filter initialized');
        await this.loadFilters();
        this.startFiltering();
        this.setupMessageListener();
    }

    async loadFilters() {
        try {
            const result = await chrome.storage.sync.get(['twitterFilters']);
            this.filters = (result.twitterFilters || []).filter(f => f.enabled);
            console.log(`Loaded ${this.filters.length} active filters`);
        } catch (error) {
            console.error('Error loading filters:', error);
            this.filters = [];
        }
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'updateFilters') {
                this.filters = request.filters;
                console.log(`Updated to ${this.filters.length} active filters`);
                this.filterExistingPosts();
                sendResponse({ success: true });
            }
        });
    }

    startFiltering() {
        if (this.isRunning) return;

        this.isRunning = true;

        // Filter existing posts
        this.filterExistingPosts();

        // Set up observer for new posts
        this.setupObserver();

        // Periodic cleanup and refilter
        setInterval(() => {
            this.filterExistingPosts();
        }, 5000);
    }

    setupObserver() {
        // Create observer to watch for new tweets
        this.observer = new MutationObserver((mutations) => {
            let hasNewPosts = false;

            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if this is a tweet or contains tweets
                        if (this.isTweetElement(node) || node.querySelector('[data-testid="tweet"]')) {
                            hasNewPosts = true;
                        }
                    }
                });
            });

            if (hasNewPosts) {
                setTimeout(() => this.filterExistingPosts(), 100);
            }
        });

        // Start observing
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    isTweetElement(element) {
        return element.getAttribute && (
            element.getAttribute('data-testid') === 'tweet' ||
            element.getAttribute('data-testid') === 'tweetText' ||
            element.querySelector('[data-testid="tweet"]')
        );
    }

    filterExistingPosts() {
        if (this.filters.length === 0) return;

        // Find all tweet elements
        const tweets = document.querySelectorAll('[data-testid="tweet"]');

        tweets.forEach((tweet) => {
            if (this.shouldHideTweet(tweet)) {
                this.hideTweet(tweet);
            }
        });
    }

    shouldHideTweet(tweetElement) {
        if (tweetElement.style.display === 'none' || tweetElement.classList.contains('filtered-tweet')) {
            return false; // Already hidden
        }

        for (const filter of this.filters) {
            if (this.matchesFilter(tweetElement, filter)) {
                return true;
            }
        }

        return false;
    }

    matchesFilter(tweetElement, filter) {
        switch (filter.type) {
            case 'keywords':
                return this.matchesKeywords(tweetElement, filter.keywords);
            case 'video':
                return this.hasVideo(tweetElement);
            case 'links':
                return this.hasLinks(tweetElement);
            case 'retweets':
                return this.isRetweet(tweetElement);
            case 'verified':
                return this.isFromVerifiedUser(tweetElement);
            case 'engagement':
                return this.isEngagementBait(tweetElement);
            default:
                return false;
        }
    }

    matchesKeywords(tweetElement, keywords) {
        if (!keywords || keywords.length === 0) return false;

        const tweetText = this.getTweetText(tweetElement).toLowerCase();

        return keywords.some(keyword =>
            tweetText.includes(keyword.toLowerCase())
        );
    }

    hasVideo(tweetElement) {
        return !!(
            tweetElement.querySelector('[data-testid="videoPlayer"]') ||
            tweetElement.querySelector('video') ||
            tweetElement.querySelector('[data-testid="videoComponent"]')
        );
    }

    hasLinks(tweetElement) {
        const links = tweetElement.querySelectorAll('a[href*="http"]');
        // Filter out internal Twitter links
        for (const link of links) {
            const href = link.getAttribute('href');
            if (href && !href.includes('twitter.com') && !href.includes('x.com') && !href.startsWith('/')) {
                return true;
            }
        }
        return false;
    }

    isRetweet(tweetElement) {
        return !!(
            tweetElement.querySelector('[data-testid="socialContext"]') ||
            tweetElement.textContent.includes('Retweeted') ||
            tweetElement.querySelector('[aria-label*="Retweet"]')
        );
    }

    isFromVerifiedUser(tweetElement) {
        return !!(
            tweetElement.querySelector('[data-testid="icon-verified"]') ||
            tweetElement.querySelector('[aria-label*="Verified account"]') ||
            tweetElement.querySelector('svg[aria-label*="Verified"]')
        );
    }

    isEngagementBait(tweetElement) {
        const tweetText = this.getTweetText(tweetElement).toLowerCase();

        const engagementPatterns = [
            'like if you',
            'retweet if',
            'rt if',
            'agree if',
            'comment if',
            'share if',
            'follow if',
            'like this if',
            'retweet this if',
            'say yes if',
            'type yes if',
            'drop a',
            'drop your',
            'who else',
            'am i the only one',
            'unpopular opinion',
            'controversial take',
            'change my mind',
            'prove me wrong',
            'this will probably get me cancelled',
            'hot take',
            'i said what i said'
        ];

        return engagementPatterns.some(pattern =>
            tweetText.includes(pattern)
        );
    }

    getTweetText(tweetElement) {
        // Get text content, excluding reply/retweet metadata
        const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
        if (textElement) {
            return textElement.textContent || '';
        }

        // Fallback to getting all text
        const clone = tweetElement.cloneNode(true);

        // Remove elements we don't want text from
        const elementsToRemove = [
            '[data-testid="socialContext"]',
            '[data-testid="reply"]',
            '[data-testid="retweet"]',
            '[data-testid="like"]',
            '[data-testid="share"]',
            '[role="button"]'
        ];

        elementsToRemove.forEach(selector => {
            const elements = clone.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });

        return clone.textContent || '';
    }

    hideTweet(tweetElement) {
        if (tweetElement.classList.contains('filtered-tweet')) return;

        tweetElement.classList.add('filtered-tweet');

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'twitter-filter-overlay';
        overlay.innerHTML = `
            <div class="twitter-filter-message">
                <span class="filter-icon">🚫</span>
                <span class="filter-text">Post hidden by Twitter Feed Filter</span>
                <button class="show-post-btn" onclick="this.parentElement.parentElement.style.display='none'; this.parentElement.parentElement.nextElementSibling.style.display='block';">Show Post</button>
            </div>
        `;

        // Add styles if not already added
        if (!document.getElementById('twitter-filter-styles')) {
            this.addFilterStyles();
        }

        // Hide original tweet and insert overlay
        tweetElement.style.display = 'none';
        tweetElement.parentNode.insertBefore(overlay, tweetElement);

        this.hiddenCount++;
        console.log(`Hidden tweet #${this.hiddenCount}`);
    }

    addFilterStyles() {
        const styles = document.createElement('style');
        styles.id = 'twitter-filter-styles';
        styles.textContent = `
            .twitter-filter-overlay {
                background: #f7f9fa;
                border: 1px solid #e1e8ed;
                border-radius: 16px;
                margin: 8px 0;
                padding: 16px;
                text-align: center;
                color: #657786;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            
            .twitter-filter-message {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .filter-icon {
                font-size: 16px;
            }
            
            .filter-text {
                font-size: 14px;
                font-weight: 500;
            }
            
            .show-post-btn {
                background: #1da1f2;
                color: white;
                border: none;
                padding: 4px 12px;
                border-radius: 16px;
                font-size: 12px;
                cursor: pointer;
                margin-left: 8px;
            }
            
            .show-post-btn:hover {
                background: #1a91da;
            }
            
            .filtered-tweet {
                transition: opacity 0.3s ease;
            }
        `;

        document.head.appendChild(styles);
    }

    // Public method to get stats
    getStats() {
        return {
            hiddenCount: this.hiddenCount,
            activeFilters: this.filters.length
        };
    }
}

// Initialize the filter when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new TwitterFeedFilter();
    });
} else {
    new TwitterFeedFilter();
}

// Make it available globally for debugging
window.twitterFilter = new TwitterFeedFilter(); 