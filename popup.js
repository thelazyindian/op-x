// X Feed Filter - Popup Script

class XFilterManager {
    constructor() {
        this.filters = [];
        this.exceptions = {
            followingOnly: false,
            usernames: []
        };
        this.predefinedFilters = {
            ads: { name: "Hide Ads & Promoted Posts", type: "ads", keywords: [] },
            video: { name: "Hide Video Posts", type: "video", keywords: [] },
            engagement: { name: "Hide Engagement Bait", type: "engagement", keywords: [] },
            retweets: { name: "Hide Retweets", type: "retweets", keywords: [] },
            links: { name: "Hide Posts with Links", type: "links", keywords: [] },
            verified: { name: "Hide Verified Users", type: "verified", keywords: [] }
        };
        this.init();
    }

    async init() {
        await this.loadFilters();
        await this.loadExceptions();
        this.detectAndApplyXTheme();
        this.setupEventListeners();
        this.updateUI();
        this.updateStatus();
    }

    async detectAndApplyXTheme() {
        try {
            // Query the active tab to detect X's theme
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (tab && (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
                // Execute script to detect theme using Manifest V3 API
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        // Multiple ways to detect X's dark mode
                        const isDarkMode =
                            document.body.style.backgroundColor.includes('rgb(0, 0, 0)') ||
                            document.body.style.backgroundColor.includes('rgb(21, 32, 43)') ||
                            document.documentElement.style.colorScheme?.includes('dark') ||
                            document.querySelector('[data-theme="dark"]') !== null ||
                            window.getComputedStyle(document.body).backgroundColor.includes('rgb(0, 0, 0)') ||
                            window.getComputedStyle(document.body).backgroundColor.includes('rgb(21, 32, 43)') ||
                            window.getComputedStyle(document.body).backgroundColor.includes('rgb(22, 24, 28)');

                        return isDarkMode;
                    }
                });

                if (results && results[0] && results[0].result) {
                    this.applyTheme(true); // Dark mode detected
                } else {
                    this.applyTheme(false); // Light mode
                }
            } else {
                // Fallback to system preference
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                this.applyTheme(prefersDark);
            }
        } catch (error) {
            console.log('Could not detect X theme, using system preference');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.applyTheme(prefersDark);
        }
    }

    applyTheme(isDarkMode) {
        const root = document.documentElement;

        if (isDarkMode) {
            // X Dark Mode colors
            root.style.setProperty('--x-bg-primary', 'rgb(0, 0, 0)');
            root.style.setProperty('--x-bg-secondary', 'rgb(22, 24, 28)');
            root.style.setProperty('--x-bg-hover', 'rgb(28, 30, 34)');
            root.style.setProperty('--x-border-color', 'rgb(47, 51, 54)');
            root.style.setProperty('--x-text-primary', 'rgb(231, 233, 234)');
            root.style.setProperty('--x-text-secondary', 'rgb(113, 118, 123)');
            root.style.setProperty('--x-text-tertiary', 'rgb(113, 118, 123)');
        } else {
            // X Light Mode colors
            root.style.setProperty('--x-bg-primary', 'rgb(255, 255, 255)');
            root.style.setProperty('--x-bg-secondary', 'rgb(247, 249, 249)');
            root.style.setProperty('--x-bg-hover', 'rgb(247, 249, 249)');
            root.style.setProperty('--x-border-color', 'rgb(207, 217, 222)');
            root.style.setProperty('--x-text-primary', 'rgb(15, 20, 25)');
            root.style.setProperty('--x-text-secondary', 'rgb(83, 100, 113)');
            root.style.setProperty('--x-text-tertiary', 'rgb(113, 118, 123)');
        }

        // X brand colors (consistent across themes)
        root.style.setProperty('--x-blue', 'rgb(29, 161, 242)');
        root.style.setProperty('--x-blue-hover', 'rgb(26, 145, 218)');
    }

    setupEventListeners() {
        // Toggle switches for predefined filters
        document.querySelectorAll('input[data-filter]').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                this.togglePredefinedFilter(e.target.dataset.filter, e.target.checked);
            });
        });

        // Custom keywords textarea
        const customKeywords = document.getElementById('customKeywords');
        let keywordTimeout;

        customKeywords.addEventListener('input', () => {
            clearTimeout(keywordTimeout);
            keywordTimeout = setTimeout(() => {
                this.updateCustomKeywords(customKeywords.value);
            }, 500); // Debounce 500ms
        });

        // Following exception toggle
        const followingException = document.getElementById('followingException');
        followingException.addEventListener('change', (e) => {
            this.updateFollowingException(e.target.checked);
        });

        // Username exceptions textarea
        const usernameExceptions = document.getElementById('usernameExceptions');
        let usernameTimeout;

        usernameExceptions.addEventListener('input', () => {
            clearTimeout(usernameTimeout);
            usernameTimeout = setTimeout(() => {
                this.updateUsernameExceptions(usernameExceptions.value);
            }, 500); // Debounce 500ms
        });
    }

    async togglePredefinedFilter(filterKey, enabled) {
        const filterTemplate = this.predefinedFilters[filterKey];
        if (!filterTemplate) return;

        if (enabled) {
            // Add filter
            const filter = {
                id: `predefined_${filterKey}`,
                name: filterTemplate.name,
                description: `Auto-generated ${filterTemplate.name.toLowerCase()}`,
                keywords: filterTemplate.keywords,
                type: filterTemplate.type,
                enabled: true,
                createdAt: new Date().toISOString()
            };

            // Remove existing filter with same type if any
            this.filters = this.filters.filter(f => f.type !== filterTemplate.type || f.id.startsWith('custom_'));
            this.filters.push(filter);
        } else {
            // Remove filter
            this.filters = this.filters.filter(f => f.id !== `predefined_${filterKey}`);
        }

        await this.saveFilters();
        this.updateContentScript();
        this.updateStatus();
    }

    async updateCustomKeywords(keywordsText) {
        const keywords = keywordsText
            .split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0);

        // Remove existing custom keywords filter
        this.filters = this.filters.filter(f => f.id !== 'custom_keywords');

        if (keywords.length > 0) {
            // Add new custom keywords filter
            const filter = {
                id: 'custom_keywords',
                name: 'Custom Keywords',
                description: `Blocking: ${keywords.slice(0, 3).join(', ')}${keywords.length > 3 ? '...' : ''}`,
                keywords: keywords,
                type: 'keywords',
                enabled: true,
                createdAt: new Date().toISOString()
            };

            this.filters.push(filter);
        }

        await this.saveFilters();
        this.updateContentScript();
        this.updateStatus();
    }

    updateUI() {
        // Update toggle switches based on current filters
        Object.keys(this.predefinedFilters).forEach(filterKey => {
            const toggle = document.querySelector(`input[data-filter="${filterKey}"]`);
            if (toggle) {
                const hasFilter = this.filters.some(f => f.id === `predefined_${filterKey}` && f.enabled);
                toggle.checked = hasFilter;
            }
        });

        // Update custom keywords textarea
        const customKeywordsFilter = this.filters.find(f => f.id === 'custom_keywords');
        const customKeywords = document.getElementById('customKeywords');
        if (customKeywordsFilter && customKeywords) {
            customKeywords.value = customKeywordsFilter.keywords.join(', ');
        }

        // Update exceptions UI
        const followingException = document.getElementById('followingException');
        if (followingException) {
            followingException.checked = this.exceptions.followingOnly;
        }

        const usernameExceptions = document.getElementById('usernameExceptions');
        if (usernameExceptions) {
            usernameExceptions.value = this.exceptions.usernames.join('\n');
        }
    }

    async loadFilters() {
        try {
            const result = await chrome.storage.sync.get(['twitterFilters']);
            this.filters = result.twitterFilters || [];
        } catch (error) {
            console.error('Error loading filters:', error);
            this.filters = [];
        }
    }

    async saveFilters() {
        try {
            await chrome.storage.sync.set({ twitterFilters: this.filters });
        } catch (error) {
            console.error('Error saving filters:', error);
            this.showStatus('Error saving filters', 'error');
        }
    }

    async loadExceptions() {
        try {
            const result = await chrome.storage.sync.get(['twitterExceptions']);
            this.exceptions = result.twitterExceptions || {
                followingOnly: false,
                usernames: []
            };
        } catch (error) {
            console.error('Error loading exceptions:', error);
            this.exceptions = {
                followingOnly: false,
                usernames: []
            };
        }
    }

    async saveExceptions() {
        try {
            await chrome.storage.sync.set({ twitterExceptions: this.exceptions });
        } catch (error) {
            console.error('Error saving exceptions:', error);
            this.showStatus('Error saving exceptions', 'error');
        }
    }

    async updateFollowingException(enabled) {
        this.exceptions.followingOnly = enabled;
        await this.saveExceptions();
        this.updateContentScript();
        this.updateStatus();
    }

    async updateUsernameExceptions(usernamesText) {
        const usernames = usernamesText
            .split('\n')
            .map(u => u.trim())
            .filter(u => u.length > 0)
            .map(u => u.startsWith('@') ? u : `@${u}`); // Ensure @ prefix

        this.exceptions.usernames = usernames;
        await this.saveExceptions();
        this.updateContentScript();
        this.updateStatus();
    }

    async updateContentScript() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                console.log('No active tab found');
                return;
            }

            if (!tab.url || !(tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
                console.log('Not on X/Twitter, skipping content script update');
                return;
            }

            // Check if tab is fully loaded
            if (tab.status !== 'complete') {
                console.log('Tab still loading, skipping content script update');
                return;
            }

            // Try to send message with timeout and better error handling
            const message = {
                action: 'updateFilters',
                filters: this.filters.filter(f => f.enabled),
                exceptions: this.exceptions
            };

            // Add a small delay to ensure content script is ready
            await new Promise(resolve => setTimeout(resolve, 100));

            await chrome.tabs.sendMessage(tab.id, message);
            console.log('Successfully updated content script');

        } catch (error) {
            // Handle specific connection errors gracefully
            if (error.message.includes('Could not establish connection') ||
                error.message.includes('Receiving end does not exist') ||
                error.message.includes('message channel closed') ||
                error.message.includes('Extension context invalidated')) {
                console.log('Content script not ready - this is normal on page load/refresh');
            } else {
                console.error('Unexpected error updating content script:', error);
            }
        }
    }

    updateStatus() {
        const activeFilters = this.filters.filter(f => f.enabled).length;
        const hasExceptions = this.exceptions.followingOnly || this.exceptions.usernames.length > 0;
        const statusText = document.getElementById('statusText');
        const enabledCount = document.getElementById('enabledCount');

        if (activeFilters === 0) {
            statusText.textContent = 'Ready to filter your X feed!';
            enabledCount.style.display = 'none';
        } else {
            let statusMessage = 'Filters active and working';
            if (hasExceptions) {
                statusMessage += ' (with exceptions)';
            }
            statusText.textContent = statusMessage;
            enabledCount.textContent = `${activeFilters} active`;
            enabledCount.style.display = 'inline';
        }
    }

    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('statusText');
        const originalText = statusElement.textContent;

        statusElement.textContent = message;
        statusElement.style.color = type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#666';

        setTimeout(() => {
            statusElement.textContent = originalText;
            statusElement.style.color = '#666';
            this.updateStatus();
        }, 2000);
    }
}

// Initialize the filter manager
const filterManager = new XFilterManager();

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getFilters') {
        sendResponse({
            filters: filterManager.filters.filter(f => f.enabled),
            exceptions: filterManager.exceptions
        });
    }
}); 