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

        // Create red indicator overlay
        const overlay = document.createElement('div');
        overlay.className = 'twitter-filter-indicator';

        // Determine which filter matched
        let matchedFilter = null;
        let filterReason = '';
        for (const filter of this.filters) {
            if (this.matchesFilter(tweetElement, filter)) {
                matchedFilter = filter;
                filterReason = this.getFilterReason(tweetElement, filter);
                break;
            }
        }

        const filterName = matchedFilter ? matchedFilter.name : 'Filter';

        overlay.innerHTML = `
            <div class="twitter-filter-content">
                <div class="filter-bar"></div>
                <div class="filter-info">
                    <span class="filter-icon">🚫</span>
                    <span class="filter-text">Post filtered by: <strong>${this.escapeHtml(filterName)}</strong></span>
                    ${filterReason ? `<span class="filter-reason">${this.escapeHtml(filterReason)}</span>` : ''}
                    <div class="filter-actions">
                        <button class="show-temp-btn" data-action="show-temp">Show Temporarily</button>
                        <button class="hide-permanent-btn" data-action="hide-permanent">Hide Completely</button>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners for buttons
        const showTempBtn = overlay.querySelector('.show-temp-btn');
        const hidePermanentBtn = overlay.querySelector('.hide-permanent-btn');

        showTempBtn.addEventListener('click', () => {
            if (overlay.classList.contains('temporarily-shown')) {
                // Hide again
                tweetElement.style.display = 'none';
                overlay.classList.remove('temporarily-shown');
                showTempBtn.textContent = 'Show Temporarily';
            } else {
                // Show temporarily
                tweetElement.style.display = 'block';
                overlay.classList.add('temporarily-shown');
                showTempBtn.textContent = '✓ Hide Again';
            }
        });

        hidePermanentBtn.addEventListener('click', () => {
            overlay.style.display = 'none';
            tweetElement.style.display = 'none';
        });

        // Add styles if not already added
        if (!document.getElementById('twitter-filter-styles')) {
            this.addFilterStyles();
        }

        // Hide original tweet and insert indicator
        tweetElement.style.display = 'none';
        tweetElement.parentNode.insertBefore(overlay, tweetElement);

        // Add animation for newly filtered posts
        overlay.classList.add('new-filter');
        setTimeout(() => overlay.classList.remove('new-filter'), 2000);

        this.hiddenCount++;
        console.log(`Hidden tweet #${this.hiddenCount} (${filterName})`);
    }

    addFilterStyles() {
        const styles = document.createElement('style');
        styles.id = 'twitter-filter-styles';
        styles.textContent = `
            .twitter-filter-indicator {
                background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
                border: 2px solid #e53e3e;
                border-radius: 12px;
                margin: 12px 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                position: relative;
                overflow: hidden;
                transition: all 0.3s ease;
            }
            
            .twitter-filter-indicator:hover {
                border-color: #c53030;
                box-shadow: 0 4px 12px rgba(229, 62, 62, 0.15);
            }
            
            .filter-bar {
                background: linear-gradient(90deg, #e53e3e 0%, #c53030 100%);
                height: 4px;
                width: 100%;
            }
            
            .twitter-filter-content {
                padding: 12px 16px;
            }
            
            .filter-info {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .filter-icon {
                font-size: 16px;
                flex-shrink: 0;
            }
            
            .filter-text {
                font-size: 14px;
                color: #742a2a;
                flex: 1;
                min-width: 200px;
            }
            
            .filter-text strong {
                color: #c53030;
            }
            
            .filter-reason {
                font-size: 12px;
                color: #a0aec0;
                font-style: italic;
                display: block;
                margin-top: 4px;
                padding: 4px 8px;
                background: rgba(229, 62, 62, 0.1);
                border-radius: 8px;
                border-left: 3px solid #e53e3e;
            }
            
            .filter-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
                width: 100%;
            }
            
            .show-temp-btn, .hide-permanent-btn {
                background: #e53e3e;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 16px;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s ease;
                font-weight: 500;
            }
            
            .show-temp-btn:hover {
                background: #c53030;
            }
            
            .hide-permanent-btn {
                background: #718096;
            }
            
            .hide-permanent-btn:hover {
                background: #4a5568;
            }
            
            .filtered-tweet {
                transition: all 0.3s ease;
                border: 1px solid #fed7d7;
                border-radius: 12px;
                margin: 8px 0;
                position: relative;
            }
            
            .filtered-tweet::before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: linear-gradient(90deg, #e53e3e 0%, #c53030 100%);
                border-radius: 12px 12px 0 0;
            }
            
            .temporarily-shown + .filtered-tweet {
                opacity: 0.7;
                background: #fff5f5;
            }
            
            .temporarily-shown .show-temp-btn {
                background: #38a169;
            }
            
            .temporarily-shown .show-temp-btn:hover {
                background: #2f855a;
            }
            
            /* Pulse animation for newly filtered posts */
            @keyframes filterPulse {
                0% { border-color: #e53e3e; }
                50% { border-color: #c53030; box-shadow: 0 0 20px rgba(229, 62, 62, 0.3); }
                100% { border-color: #e53e3e; }
            }
            
            .twitter-filter-indicator.new-filter {
                animation: filterPulse 2s ease-in-out;
            }
            
            /* Hide indicator when post is temporarily shown */
            .temporarily-shown {
                opacity: 0.8;
                border-style: dashed;
            }
            
            .temporarily-shown .filter-text {
                color: #38a169;
            }
            
            .temporarily-shown .filter-text strong {
                color: #2f855a;
            }
        `;

        document.head.appendChild(styles);
    }

    // Helper method to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Get specific reason why post was filtered
    getFilterReason(tweetElement, filter) {
        switch (filter.type) {
            case 'keywords':
                const tweetText = this.getTweetText(tweetElement).toLowerCase();
                const matchedKeywords = filter.keywords.filter(keyword =>
                    tweetText.includes(keyword.toLowerCase())
                );
                return matchedKeywords.length > 0 ? `Contains: "${matchedKeywords[0]}"` : '';
            case 'video':
                return 'Contains video content';
            case 'links':
                return 'Contains external links';
            case 'retweets':
                return 'Is a retweet';
            case 'verified':
                return 'From verified user';
            case 'engagement':
                const engagementText = this.getTweetText(tweetElement).toLowerCase();
                const engagementPatterns = [
                    'like if you', 'retweet if', 'rt if', 'agree if', 'comment if',
                    'share if', 'follow if', 'like this if', 'retweet this if',
                    'say yes if', 'type yes if', 'drop a', 'drop your', 'who else',
                    'am i the only one', 'unpopular opinion', 'controversial take',
                    'change my mind', 'prove me wrong', 'hot take'
                ];
                const matched = engagementPatterns.find(pattern =>
                    engagementText.includes(pattern)
                );
                return matched ? `Engagement bait: "${matched}"` : 'Engagement bait detected';
            default:
                return '';
        }
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