// Twitter Feed Filter - Popup Script

class TwitterFilterManager {
    constructor() {
        this.filters = [];
        this.init();
    }

    async init() {
        await this.loadFilters();
        this.setupEventListeners();
        this.renderFilters();
        this.updateStatus();
    }

    setupEventListeners() {
        // Add filter button
        document.getElementById('addFilterBtn').addEventListener('click', () => {
            this.addFilter();
        });

        // Filter type change
        document.getElementById('filterType').addEventListener('change', (e) => {
            this.handleFilterTypeChange(e.target.value);
        });

        // Enter key in inputs
        ['filterName', 'filterDescription', 'filterKeywords'].forEach(id => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.addFilter();
                }
            });
        });
    }

    handleFilterTypeChange(type) {
        const keywordsGroup = document.getElementById('filterKeywords').parentElement;
        const keywordsInput = document.getElementById('filterKeywords');

        switch (type) {
            case 'keywords':
                keywordsGroup.style.display = 'block';
                keywordsInput.placeholder = 'spam, engagement bait, like if you agree, retweet if';
                break;
            case 'video':
                keywordsGroup.style.display = 'none';
                break;
            case 'links':
                keywordsGroup.style.display = 'none';
                break;
            case 'retweets':
                keywordsGroup.style.display = 'none';
                break;
            case 'verified':
                keywordsGroup.style.display = 'none';
                break;
            case 'engagement':
                keywordsGroup.style.display = 'block';
                keywordsInput.placeholder = 'like if, retweet if, agree if, comment if';
                break;
            case 'ads':
                keywordsGroup.style.display = 'none';
                break;
        }
    }

    async addFilter() {
        const name = document.getElementById('filterName').value.trim();
        const description = document.getElementById('filterDescription').value.trim();
        const keywords = document.getElementById('filterKeywords').value.trim();
        const type = document.getElementById('filterType').value;

        if (!name) {
            this.showStatus('Please enter a filter name', 'error');
            return;
        }

        // Create filter object
        const filter = {
            id: Date.now().toString(),
            name,
            description,
            keywords: keywords ? keywords.split(',').map(k => k.trim()).filter(k => k) : [],
            type,
            enabled: true,
            createdAt: new Date().toISOString()
        };

        // Add to filters array
        this.filters.push(filter);

        // Save to storage
        await this.saveFilters();

        // Clear form
        this.clearForm();

        // Re-render filters
        this.renderFilters();

        // Update content script
        this.updateContentScript();

        this.showStatus('Filter added successfully!', 'success');
    }

    clearForm() {
        document.getElementById('filterName').value = '';
        document.getElementById('filterDescription').value = '';
        document.getElementById('filterKeywords').value = '';
        document.getElementById('filterType').value = 'keywords';
        this.handleFilterTypeChange('keywords');
    }

    async removeFilter(filterId) {
        this.filters = this.filters.filter(f => f.id !== filterId);
        await this.saveFilters();
        this.renderFilters();
        this.updateContentScript();
        this.showStatus('Filter removed', 'success');
    }

    async toggleFilter(filterId) {
        const filter = this.filters.find(f => f.id === filterId);
        if (filter) {
            filter.enabled = !filter.enabled;
            await this.saveFilters();
            this.renderFilters();
            this.updateContentScript();
            this.showStatus(`Filter ${filter.enabled ? 'enabled' : 'disabled'}`, 'success');
        }
    }

    renderFilters() {
        const container = document.getElementById('filtersList');

        if (this.filters.length === 0) {
            container.innerHTML = '<div class="empty-state">No filters added yet. Add your first filter above!</div>';
            return;
        }

        container.innerHTML = this.filters.map(filter => `
            <div class="filter-item">
                <div class="filter-content">
                    <div class="filter-name">${this.escapeHtml(filter.name)}</div>
                    <div class="filter-description">${this.escapeHtml(filter.description)}</div>
                    <div class="filter-keywords">
                        Type: ${this.getFilterTypeLabel(filter.type)}
                        ${filter.keywords.length > 0 ? `| Keywords: ${filter.keywords.join(', ')}` : ''}
                    </div>
                </div>
                <div class="filter-actions">
                    <label class="toggle-switch">
                        <input type="checkbox" ${filter.enabled ? 'checked' : ''} 
                               onchange="filterManager.toggleFilter('${filter.id}')">
                        <span class="slider"></span>
                    </label>
                    <button class="btn btn-danger btn-small" 
                            onclick="filterManager.removeFilter('${filter.id}')">
                        Remove
                    </button>
                </div>
            </div>
        `).join('');
    }

    getFilterTypeLabel(type) {
        const labels = {
            'keywords': 'Keywords',
            'video': 'Video Posts',
            'links': 'Posts with Links',
            'retweets': 'Retweets',
            'verified': 'Verified Users',
            'engagement': 'Engagement Bait',
            'ads': 'Ads/Promoted Posts'
        };
        return labels[type] || type;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

    async updateContentScript() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'updateFilters',
                    filters: this.filters.filter(f => f.enabled)
                });
            }
        } catch (error) {
            console.error('Error updating content script:', error);
        }
    }

    updateStatus() {
        const activeFilters = this.filters.filter(f => f.enabled).length;
        const totalFilters = this.filters.length;

        let statusText = `${activeFilters} of ${totalFilters} filters active`;
        if (totalFilters === 0) {
            statusText = 'Ready to filter your Twitter feed!';
        }

        document.getElementById('statusText').textContent = statusText;
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
const filterManager = new TwitterFilterManager();

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getFilters') {
        sendResponse({ filters: filterManager.filters.filter(f => f.enabled) });
    }
}); 