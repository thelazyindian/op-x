// Twitter Feed Filter - Content Script

class TwitterFeedFilter {
    constructor() {
        this.filters = [];
        this.exceptions = {
            followingOnly: false,
            usernames: [],
            completelyHide: false
        };
        this.hiddenCount = 0;
        this.isRunning = false;
        this.observer = null;
        this.filterTimeout = null;
        this.init();
    }

    async init() {
        console.log('🐦 Twitter Feed Filter initialized');
        await this.loadFilters();
        await this.loadExceptions();
        this.detectAndApplyTheme();
        this.startFiltering();
        this.setupMessageListener();
        this.setupThemeObserver();
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

    async loadExceptions() {
        try {
            const result = await chrome.storage.sync.get(['twitterExceptions']);
            this.exceptions = result.twitterExceptions || {
                followingOnly: false,
                usernames: [],
                completelyHide: false
            };
            console.log(`Loaded exceptions: following=${this.exceptions.followingOnly}, usernames=${this.exceptions.usernames.length}, completelyHide=${this.exceptions.completelyHide}`);
        } catch (error) {
            console.error('Error loading exceptions:', error);
            this.exceptions = {
                followingOnly: false,
                usernames: [],
                completelyHide: false
            };
        }
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'updateFilters') {
                this.filters = request.filters;
                this.exceptions = request.exceptions || { followingOnly: false, usernames: [], completelyHide: false };
                console.log(`Updated to ${this.filters.length} active filters`);
                console.log(`Updated exceptions: following=${this.exceptions.followingOnly}, usernames=${this.exceptions.usernames.length}, completelyHide=${this.exceptions.completelyHide}`);
                this.cleanupDuplicateIndicators();
                this.filterExistingPosts();
                sendResponse({ success: true });
            }
        });
    }

    cleanupDuplicateIndicators() {
        // Remove any duplicate filter indicators
        const indicators = document.querySelectorAll('.twitter-filter-indicator');
        const seenTweets = new Set();

        indicators.forEach(indicator => {
            const nextTweet = indicator.nextElementSibling;
            if (nextTweet && nextTweet.getAttribute('data-testid') === 'tweet') {
                const tweetId = this.getTweetId(nextTweet);
                if (seenTweets.has(tweetId)) {
                    // This is a duplicate, remove it
                    indicator.remove();
                } else {
                    seenTweets.add(tweetId);
                }
            }
        });
    }

    getTweetId(tweetElement) {
        // Try to get a unique identifier for the tweet
        const link = tweetElement.querySelector('a[href*="/status/"]');
        if (link) {
            return link.getAttribute('href');
        }

        // Fallback to text content hash
        const text = this.getTweetText(tweetElement);
        return text.substring(0, 100); // Use first 100 chars as identifier
    }

    startFiltering() {
        if (this.isRunning) return;

        this.isRunning = true;

        // Filter existing posts
        this.filterExistingPosts();

        // Set up observer for new posts
        this.setupObserver();

        // Periodic cleanup and refilter (reduced frequency)
        setInterval(() => {
            this.filterExistingPosts();
        }, 10000); // Changed from 5000 to 10000 (10 seconds)
    }

    setupObserver() {
        // Create observer to watch for new tweets
        this.observer = new MutationObserver((mutations) => {
            let hasNewPosts = false;

            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Skip if this is our own filter indicator
                        if (node.classList && node.classList.contains('twitter-filter-indicator')) {
                            return;
                        }

                        // Check if this is a tweet or contains tweets
                        if (this.isTweetElement(node) || node.querySelector('[data-testid="tweet"]')) {
                            hasNewPosts = true;
                        }
                    }
                });
            });

            if (hasNewPosts) {
                // Debounce the filtering to avoid excessive calls
                clearTimeout(this.filterTimeout);
                this.filterTimeout = setTimeout(() => this.filterExistingPosts(), 200);
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
            // Skip if this tweet has already been processed
            if (this.isTweetAlreadyProcessed(tweet)) {
                return;
            }

            if (this.shouldHideTweet(tweet)) {
                this.hideTweet(tweet);
            } else {
                // Mark as processed even if not hidden to avoid reprocessing
                tweet.setAttribute('data-filter-processed', 'true');
            }
        });
    }

    isTweetAlreadyProcessed(tweetElement) {
        // Check if tweet has already been processed
        if (tweetElement.getAttribute('data-filter-processed') === 'true') {
            return true;
        }

        // Check if there's already a filter indicator for this tweet
        const previousSibling = tweetElement.previousElementSibling;
        if (previousSibling && previousSibling.classList.contains('twitter-filter-indicator')) {
            return true;
        }

        // Check if the tweet itself has been marked as filtered
        if (tweetElement.classList.contains('filtered-tweet')) {
            return true;
        }

        return false;
    }

    shouldHideTweet(tweetElement) {
        // Don't process if already handled
        if (this.isTweetAlreadyProcessed(tweetElement)) {
            return false;
        }

        // Check for exceptions first
        if (this.isExemptFromFiltering(tweetElement)) {
            return false;
        }

        for (const filter of this.filters) {
            if (this.matchesFilter(tweetElement, filter)) {
                return true;
            }
        }

        return false;
    }

    isExemptFromFiltering(tweetElement) {
        // Check username exceptions first
        if (this.exceptions.usernames.length > 0) {
            const username = this.getTweetUsername(tweetElement);
            console.log(`Checking username exceptions for: ${username}`);
            console.log(`Exception list:`, this.exceptions.usernames);

            if (username) {
                // Normalize both the extracted username and exception list for comparison
                const normalizedUsername = username.toLowerCase().replace(/^@/, '');

                const isExempt = this.exceptions.usernames.some(exemptUser => {
                    const normalizedExemptUser = exemptUser.toLowerCase().replace(/^@/, '');
                    const matches = normalizedExemptUser === normalizedUsername;
                    if (matches) {
                        console.log(`✅ Username match found: ${exemptUser} === ${username}`);
                    }
                    return matches;
                });

                if (isExempt) {
                    console.log(`🚫 Tweet from ${username} is exempt (username exception)`);
                    return true;
                }
            } else {
                console.log('⚠️ Could not extract username for exception checking');
            }
        }

        // Check following exception
        if (this.exceptions.followingOnly) {
            if (this.isFromFollowedUser(tweetElement)) {
                console.log(`🚫 Tweet is exempt (following exception)`);
                return true;
            }
        }

        return false;
    }

    getTweetUsername(tweetElement) {
        // Method 1: Look for the main profile link in the tweet header
        // This is the most reliable method for getting the actual tweet author
        const profileLinkSelectors = [
            '[data-testid="User-Name"] a[href^="/"]',
            '[data-testid="User-Names"] a[href^="/"]',
            'a[href^="/"][role="link"]:not([href*="/status/"])'
        ];

        for (const selector of profileLinkSelectors) {
            const profileLinks = tweetElement.querySelectorAll(selector);
            for (const link of profileLinks) {
                const href = link.getAttribute('href');
                if (href) {
                    // Match usernames like "/username" or "/username?param=value"
                    const usernameMatch = href.match(/^\/([a-zA-Z0-9_]+)(?:\?|$)/);
                    if (usernameMatch) {
                        const username = usernameMatch[1];
                        // Exclude Twitter system paths
                        const excludedPaths = ['i', 'home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists', 'profile', 'more', 'search', 'settings', 'help', 'display'];
                        if (!excludedPaths.includes(username.toLowerCase())) {
                            console.log(`Found username via profile link: @${username}`);
                            return `@${username}`;
                        }
                    }
                }
            }
        }

        // Method 2: Look for @username in the tweet header area specifically
        const userNameAreas = [
            tweetElement.querySelector('[data-testid="User-Name"]'),
            tweetElement.querySelector('[data-testid="User-Names"]'),
            tweetElement.querySelector('[data-testid="UserName"]')
        ].filter(Boolean);

        for (const area of userNameAreas) {
            // Look for spans containing @username
            const spans = area.querySelectorAll('span');
            for (const span of spans) {
                const text = span.textContent.trim();
                if (text.match(/^@[a-zA-Z0-9_]+$/)) {
                    console.log(`Found username via @mention in header: ${text}`);
                    return text;
                }
            }

            // Look for any text that looks like a username
            const allText = area.textContent;
            const usernameMatch = allText.match(/@([a-zA-Z0-9_]+)/);
            if (usernameMatch) {
                console.log(`Found username via text pattern in header: @${usernameMatch[1]}`);
                return `@${usernameMatch[1]}`;
            }
        }

        // Method 3: Look for the first non-status link in the tweet (fallback)
        const allLinks = tweetElement.querySelectorAll('a[href^="/"]');
        for (const link of allLinks) {
            const href = link.getAttribute('href');
            if (href && !href.includes('/status/') && !href.includes('/photo/') && !href.includes('/video/')) {
                const usernameMatch = href.match(/^\/([a-zA-Z0-9_]+)(?:\/|$|\?)/);
                if (usernameMatch) {
                    const username = usernameMatch[1];
                    const excludedPaths = ['i', 'home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists', 'profile', 'more', 'search', 'settings', 'help', 'display'];
                    if (!excludedPaths.includes(username.toLowerCase()) && username.length <= 15) { // Twitter usernames max 15 chars
                        console.log(`Found username via fallback link: @${username}`);
                        return `@${username}`;
                    }
                }
            }
        }

        // Method 4: Look for any @username pattern in the visible text (last resort)
        const tweetText = tweetElement.textContent;
        const mentionMatches = tweetText.match(/@([a-zA-Z0-9_]+)/g);
        if (mentionMatches && mentionMatches.length > 0) {
            // Use the first @mention found, assuming it might be the author
            const firstMention = mentionMatches[0];
            console.log(`Found username via text mention (fallback): ${firstMention}`);
            return firstMention;
        }

        console.log('Could not extract username from tweet');
        return null;
    }

    isFromFollowedUser(tweetElement) {
        // Check if the tweet is from a followed user
        // This is challenging to detect reliably, so we'll use several heuristics

        // Method 1: Look for "Following" badge or similar indicators
        const followingIndicators = [
            '[data-testid="userFollowIndicator"]',
            '[aria-label*="Following"]',
            '[title*="Following"]'
        ];

        for (const selector of followingIndicators) {
            if (tweetElement.querySelector(selector)) {
                return true;
            }
        }

        // Method 2: Check for "Following" text near the username
        const userNameArea = tweetElement.querySelector('[data-testid="User-Name"]') ||
            tweetElement.querySelector('[data-testid="User-Names"]');

        if (userNameArea) {
            const parentElement = userNameArea.closest('[data-testid="tweet"]') || userNameArea.parentElement;
            const allText = parentElement ? parentElement.textContent.toLowerCase() : '';

            // Look for "following" indicator in the tweet header area
            if (allText.includes('following')) {
                return true;
            }
        }

        // Method 3: Check if there's a "Follow" button (if no follow button, likely already following)
        // This is a weak heuristic but can be useful
        const followButton = tweetElement.querySelector('[data-testid*="follow"]');
        if (!followButton) {
            // No follow button found - might indicate already following
            // This is not reliable enough on its own, so we'll be conservative
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
            case 'ads':
                return this.isAd(tweetElement);
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

    isAd(tweetElement) {
        // Method 1: Look for official "Promoted" indicators (most reliable)
        const promotedIndicators = [
            '[data-testid="promotedIndicator"]',     // Twitter's official promoted indicator
            '[aria-label*="Promoted"]'              // Accessibility labels for promoted content
        ];

        for (const selector of promotedIndicators) {
            const element = tweetElement.querySelector(selector);
            if (element) {
                const text = element.textContent.toLowerCase();
                if (text.includes('promoted') || text.includes('sponsored')) {
                    return true;
                }
            }
        }

        // Method 2: Check social context for promotional indicators (but exclude action buttons)
        const socialContext = tweetElement.querySelector('[data-testid="socialContext"]');
        if (socialContext) {
            const contextText = socialContext.textContent.toLowerCase();
            // Only match if it's clearly promotional context, not action buttons
            if (contextText.includes('promoted by') ||
                contextText.includes('sponsored by') ||
                contextText.includes('advertisement') ||
                (contextText.includes('promoted') && !contextText.includes('promote this'))) {
                return true;
            }
        }

        // Method 3: Look for specific ad-related attributes
        if (tweetElement.getAttribute('data-promoted') === 'true' ||
            tweetElement.getAttribute('data-ad') === 'true') {
            return true;
        }

        // Method 4: Check for "Promoted" or "Sponsored" labels that appear as standalone indicators
        // But exclude buttons and interactive elements
        const spans = tweetElement.querySelectorAll('span');
        for (const span of spans) {
            const spanText = span.textContent.toLowerCase().trim();
            const parentElement = span.closest('button, [role="button"], a, [data-testid*="promote"]');

            // Only consider it promotional if it's not part of an interactive element
            if (!parentElement &&
                (spanText === 'promoted' ||
                    spanText === 'sponsored' ||
                    spanText === 'advertisement' ||
                    spanText === 'ad')) {
                return true;
            }
        }

        // Method 5: Check for promotional URLs with tracking parameters
        // But be more specific about what constitutes a promotional link
        const links = tweetElement.querySelectorAll('a[href]');
        for (const link of links) {
            const href = link.getAttribute('href');
            if (href) {
                // Look for multiple tracking parameters (more likely to be ads)
                const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
                const hasMultipleTracking = trackingParams.filter(param => href.includes(param)).length >= 2;

                if (hasMultipleTracking ||
                    href.includes('ads.twitter.com') ||
                    href.includes('promote.twitter.com') ||
                    (href.includes('utm_') && href.includes('promo'))) {
                    return true;
                }
            }
        }

        // Method 6: Look for "Promoted Tweet" or "Sponsored" text in specific contexts
        // Exclude text that appears in action areas
        const tweetText = this.getTweetText(tweetElement).toLowerCase();
        const fullText = tweetElement.textContent.toLowerCase();

        // Check if "promoted" appears in a promotional context, not as an action
        if ((fullText.includes('promoted tweet') ||
            fullText.includes('sponsored tweet') ||
            fullText.includes('promoted by ') ||
            fullText.includes('sponsored by ')) &&
            !fullText.includes('promote this tweet') &&
            !fullText.includes('promote your tweet')) {
            return true;
        }

        // Method 7: Check tweet container, but be more specific
        const tweetContainer = tweetElement.closest('[data-testid="cellInnerDiv"]');
        if (tweetContainer) {
            const containerText = tweetContainer.textContent.toLowerCase();
            // Only match if it clearly indicates a promoted post, not action buttons
            if (containerText.includes('promoted by ') ||
                containerText.includes('sponsored by ') ||
                (containerText.includes('promoted') &&
                    containerText.includes('learn more') &&
                    !containerText.includes('promote this'))) {
                return true;
            }
        }

        return false;
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
        tweetElement.setAttribute('data-filter-processed', 'true');

        // Check if we should completely hide or show indicator
        if (this.exceptions.completelyHide) {
            // Completely hide the tweet without any indication
            tweetElement.style.display = 'none';
            this.hiddenCount++;
            console.log(`Hidden tweet #${this.hiddenCount} (completely hidden)`);
            return;
        }

        // Show filter indicator (original behavior)
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

        // Create red indicator overlay
        const overlay = document.createElement('div');
        overlay.className = 'twitter-filter-indicator';

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
            /* Detect Twitter theme for dynamic styling */
            .twitter-filter-indicator {
                background: var(--twitter-bg-primary, rgb(255, 255, 255));
                border: 1px solid var(--twitter-border-color, rgb(207, 217, 222));
                border-radius: 16px;
                margin: 12px 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                position: relative;
                overflow: hidden;
                transition: all 0.2s ease;
            }
            
            /* Dark mode detection and styling */
            [data-theme="dark"] .twitter-filter-indicator,
            html[style*="color-scheme: dark"] .twitter-filter-indicator,
            body[style*="background-color: rgb(0, 0, 0)"] .twitter-filter-indicator,
            .twitter-filter-indicator:has(~ [data-testid="tweet"] [style*="color: rgb(231, 233, 234)"]) {
                background: rgb(22, 24, 28);
                border-color: rgb(47, 51, 54);
            }
            
            .twitter-filter-indicator:hover {
                background: var(--twitter-bg-hover, rgb(247, 249, 249));
            }
            
            [data-theme="dark"] .twitter-filter-indicator:hover,
            html[style*="color-scheme: dark"] .twitter-filter-indicator:hover,
            body[style*="background-color: rgb(0, 0, 0)"] .twitter-filter-indicator:hover {
                background: rgb(28, 30, 34);
            }
            
            .filter-bar {
                background: var(--twitter-border-color, rgb(207, 217, 222));
                height: 1px;
                width: 100%;
            }
            
            [data-theme="dark"] .filter-bar,
            html[style*="color-scheme: dark"] .filter-bar,
            body[style*="background-color: rgb(0, 0, 0)"] .filter-bar {
                background: rgb(47, 51, 54);
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
                font-size: 14px;
                flex-shrink: 0;
                opacity: 0.6;
            }
            
            .filter-text {
                font-size: 13px;
                color: var(--twitter-text-secondary, rgb(83, 100, 113));
                flex: 1;
                min-width: 200px;
                font-weight: 400;
            }
            
            [data-theme="dark"] .filter-text,
            html[style*="color-scheme: dark"] .filter-text,
            body[style*="background-color: rgb(0, 0, 0)"] .filter-text {
                color: rgb(113, 118, 123);
            }
            
            .filter-text strong {
                color: var(--twitter-text-primary, rgb(15, 20, 25));
                font-weight: 600;
            }
            
            [data-theme="dark"] .filter-text strong,
            html[style*="color-scheme: dark"] .filter-text strong,
            body[style*="background-color: rgb(0, 0, 0)"] .filter-text strong {
                color: rgb(231, 233, 234);
            }
            
            .filter-reason {
                font-size: 11px;
                color: var(--twitter-text-tertiary, rgb(113, 118, 123));
                font-style: italic;
                display: block;
                margin-top: 4px;
                padding: 4px 8px;
                background: var(--twitter-bg-secondary, rgb(247, 249, 249));
                border-radius: 6px;
                border-left: 2px solid var(--twitter-border-color, rgb(207, 217, 222));
            }
            
            [data-theme="dark"] .filter-reason,
            html[style*="color-scheme: dark"] .filter-reason,
            body[style*="background-color: rgb(0, 0, 0)"] .filter-reason {
                color: rgb(113, 118, 123);
                background: rgb(28, 30, 34);
                border-left-color: rgb(47, 51, 54);
            }
            
            .filter-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
                width: 100%;
            }
            
            .show-temp-btn, .hide-permanent-btn {
                background: var(--twitter-color-blue, rgb(29, 161, 242));
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s ease;
                font-weight: 600;
                min-height: 32px;
            }
            
            .show-temp-btn:hover {
                background: var(--twitter-color-blue-hover, rgb(26, 145, 218));
            }
            
            .hide-permanent-btn {
                background: var(--twitter-text-secondary, rgb(83, 100, 113));
            }
            
            .hide-permanent-btn:hover {
                background: var(--twitter-text-primary, rgb(15, 20, 25));
            }
            
            [data-theme="dark"] .hide-permanent-btn,
            html[style*="color-scheme: dark"] .hide-permanent-btn,
            body[style*="background-color: rgb(0, 0, 0)"] .hide-permanent-btn {
                background: rgb(113, 118, 123);
            }
            
            [data-theme="dark"] .hide-permanent-btn:hover,
            html[style*="color-scheme: dark"] .hide-permanent-btn:hover,
            body[style*="background-color: rgb(0, 0, 0)"] .hide-permanent-btn:hover {
                background: rgb(231, 233, 234);
                color: rgb(15, 20, 25);
            }
            
            .filtered-tweet {
                transition: all 0.2s ease;
                border: 1px solid var(--twitter-border-color, rgb(207, 217, 222));
                border-radius: 16px;
                margin: 8px 0;
                position: relative;
                background: var(--twitter-bg-primary, rgb(255, 255, 255));
            }
            
            [data-theme="dark"] .filtered-tweet,
            html[style*="color-scheme: dark"] .filtered-tweet,
            body[style*="background-color: rgb(0, 0, 0)"] .filtered-tweet {
                border-color: rgb(47, 51, 54);
                background: rgb(22, 24, 28);
            }
            
            .filtered-tweet::before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: var(--twitter-border-color, rgb(207, 217, 222));
                border-radius: 16px 16px 0 0;
            }
            
            [data-theme="dark"] .filtered-tweet::before,
            html[style*="color-scheme: dark"] .filtered-tweet::before,
            body[style*="background-color: rgb(0, 0, 0)"] .filtered-tweet::before {
                background: rgb(47, 51, 54);
            }
            
            .temporarily-shown + .filtered-tweet {
                opacity: 0.8;
                background: var(--twitter-bg-secondary, rgb(247, 249, 249));
            }
            
            [data-theme="dark"] .temporarily-shown + .filtered-tweet,
            html[style*="color-scheme: dark"] .temporarily-shown + .filtered-tweet,
            body[style*="background-color: rgb(0, 0, 0)"] .temporarily-shown + .filtered-tweet {
                background: rgb(28, 30, 34);
            }
            
            .temporarily-shown .show-temp-btn {
                background: var(--twitter-color-green, rgb(0, 186, 124));
            }
            
            .temporarily-shown .show-temp-btn:hover {
                background: var(--twitter-color-green-hover, rgb(0, 167, 111));
            }
            
            /* Remove pulse animation - too attention grabbing */
            .twitter-filter-indicator.new-filter {
                /* No animation */
            }
            
            /* Subtle state changes */
            .temporarily-shown {
                opacity: 0.9;
                border-style: solid;
                border-width: 1px;
            }
            
            .temporarily-shown .filter-text {
                color: var(--twitter-color-green, rgb(0, 186, 124));
            }
            
            .temporarily-shown .filter-text strong {
                color: var(--twitter-color-green, rgb(0, 186, 124));
            }
            
            /* Twitter-like spacing and typography */
            .twitter-filter-indicator * {
                box-sizing: border-box;
            }
            
            /* Match Twitter's button styling more closely */
            .show-temp-btn, .hide-permanent-btn {
                border-radius: 9999px;
                font-family: inherit;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                outline: none;
            }
            
            .show-temp-btn:focus, .hide-permanent-btn:focus {
                outline: 2px solid var(--twitter-color-blue, rgb(29, 161, 242));
                outline-offset: 2px;
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
            case 'ads':
                return 'Contains promoted content';
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

    detectAndApplyTheme() {
        // Detect Twitter's current theme
        const isDarkMode = this.isTwitterDarkMode();

        // Add theme class to filter indicators
        document.documentElement.setAttribute('data-twitter-theme', isDarkMode ? 'dark' : 'light');

        // Update CSS custom properties based on detected theme
        this.updateThemeProperties(isDarkMode);
    }

    isTwitterDarkMode() {
        // Method 1: Check for dark mode indicators in the body style
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        if (bodyBg.includes('rgb(0, 0, 0)') || bodyBg.includes('rgb(21, 32, 43)') || bodyBg.includes('rgb(22, 24, 28)')) {
            return true;
        }

        // Method 2: Check for dark theme class or attribute
        if (document.body.classList.contains('dark-theme') ||
            document.documentElement.getAttribute('data-theme') === 'dark' ||
            document.body.getAttribute('data-theme') === 'dark') {
            return true;
        }

        // Method 3: Check color scheme meta tag or CSS
        const colorScheme = window.getComputedStyle(document.documentElement).colorScheme;
        if (colorScheme && colorScheme.includes('dark')) {
            return true;
        }

        // Method 4: Check Twitter's specific elements
        const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
        if (tweetElements.length > 0) {
            const firstTweet = tweetElements[0];
            const tweetBg = window.getComputedStyle(firstTweet).backgroundColor;
            if (tweetBg.includes('rgb(22, 24, 28)') || tweetBg.includes('rgb(21, 32, 43)')) {
                return true;
            }
        }

        return false;
    }

    updateThemeProperties(isDarkMode) {
        const root = document.documentElement;

        if (isDarkMode) {
            root.style.setProperty('--twitter-bg-primary', 'rgb(22, 24, 28)');
            root.style.setProperty('--twitter-bg-secondary', 'rgb(28, 30, 34)');
            root.style.setProperty('--twitter-bg-hover', 'rgb(28, 30, 34)');
            root.style.setProperty('--twitter-border-color', 'rgb(47, 51, 54)');
            root.style.setProperty('--twitter-text-primary', 'rgb(231, 233, 234)');
            root.style.setProperty('--twitter-text-secondary', 'rgb(113, 118, 123)');
            root.style.setProperty('--twitter-text-tertiary', 'rgb(113, 118, 123)');
        } else {
            root.style.setProperty('--twitter-bg-primary', 'rgb(255, 255, 255)');
            root.style.setProperty('--twitter-bg-secondary', 'rgb(247, 249, 249)');
            root.style.setProperty('--twitter-bg-hover', 'rgb(247, 249, 249)');
            root.style.setProperty('--twitter-border-color', 'rgb(207, 217, 222)');
            root.style.setProperty('--twitter-text-primary', 'rgb(15, 20, 25)');
            root.style.setProperty('--twitter-text-secondary', 'rgb(83, 100, 113)');
            root.style.setProperty('--twitter-text-tertiary', 'rgb(113, 118, 123)');
        }

        // Twitter brand colors (consistent across themes)
        root.style.setProperty('--twitter-color-blue', 'rgb(29, 161, 242)');
        root.style.setProperty('--twitter-color-blue-hover', 'rgb(26, 145, 218)');
        root.style.setProperty('--twitter-color-green', 'rgb(0, 186, 124)');
        root.style.setProperty('--twitter-color-green-hover', 'rgb(0, 167, 111)');
    }

    setupThemeObserver() {
        // Watch for theme changes
        const themeObserver = new MutationObserver(() => {
            const newTheme = this.isTwitterDarkMode();
            const currentTheme = document.documentElement.getAttribute('data-twitter-theme');

            if ((newTheme && currentTheme !== 'dark') || (!newTheme && currentTheme !== 'light')) {
                this.detectAndApplyTheme();
            }
        });

        // Observe changes to body and html that might indicate theme changes
        themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['class', 'style', 'data-theme']
        });

        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'style', 'data-theme']
        });
    }

    // Debug method to test username extraction - call from browser console
    debugUsernameExtraction() {
        console.log('🔍 Testing username extraction on visible tweets...');
        const tweets = document.querySelectorAll('[data-testid="tweet"]');

        tweets.forEach((tweet, index) => {
            if (index < 5) { // Only test first 5 tweets to avoid spam
                console.log(`\n--- Tweet ${index + 1} ---`);
                const username = this.getTweetUsername(tweet);
                console.log(`Extracted username: ${username || 'NONE'}`);

                // Show some context about the tweet
                const tweetText = this.getTweetText(tweet).substring(0, 100);
                console.log(`Tweet text preview: "${tweetText}..."`);
            }
        });

        console.log(`\n🎯 Current username exceptions: ${this.exceptions.usernames.join(', ')}`);
        console.log(`📱 Following exemption enabled: ${this.exceptions.followingOnly}`);
    }

    // Debug method to test ad detection - call from browser console
    debugAdDetection() {
        console.log('🚫 Testing ad detection on visible tweets...');
        const tweets = document.querySelectorAll('[data-testid="tweet"]');

        tweets.forEach((tweet, index) => {
            if (index < 10) { // Test first 10 tweets
                console.log(`\n--- Tweet ${index + 1} ---`);
                const isAd = this.isAd(tweet);
                console.log(`Detected as ad: ${isAd ? '✅ YES' : '❌ NO'}`);

                if (isAd) {
                    console.log('🔍 Why it was detected as an ad:');

                    // Check each method to see which one triggered
                    const promotedIndicators = tweet.querySelectorAll('[data-testid="promotedIndicator"], [aria-label*="Promoted"]');
                    if (promotedIndicators.length > 0) {
                        console.log('  → Official promoted indicators found');
                    }

                    const socialContext = tweet.querySelector('[data-testid="socialContext"]');
                    if (socialContext) {
                        const contextText = socialContext.textContent.toLowerCase();
                        if (contextText.includes('promoted by') || contextText.includes('sponsored by')) {
                            console.log('  → Social context indicates promotion');
                        }
                    }

                    const fullText = tweet.textContent.toLowerCase();
                    if (fullText.includes('promoted tweet') || fullText.includes('sponsored tweet')) {
                        console.log('  → Contains "promoted/sponsored tweet" text');
                    }

                    const spans = tweet.querySelectorAll('span');
                    for (const span of spans) {
                        const spanText = span.textContent.toLowerCase().trim();
                        const parentElement = span.closest('button, [role="button"], a, [data-testid*="promote"]');
                        if (!parentElement && (spanText === 'promoted' || spanText === 'sponsored' || spanText === 'advertisement')) {
                            console.log(`  → Standalone promotional label found: "${spanText}"`);
                        }
                    }
                }

                // Show tweet preview
                const tweetText = this.getTweetText(tweet).substring(0, 100);
                console.log(`Tweet preview: "${tweetText}..."`);

                // Check for promote buttons (which should NOT trigger ad detection)
                const promoteButtons = tweet.querySelectorAll('button, [role="button"]');
                const hasPromoteButton = Array.from(promoteButtons).some(btn =>
                    btn.textContent.toLowerCase().includes('promote')
                );
                if (hasPromoteButton) {
                    console.log('📌 Note: Tweet has "Promote" button (should NOT be filtered)');
                }
            }
        });
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