# 🐦 X Feed Filter

A powerful Chrome extension that lets you filter your X feed by hiding posts based on custom rules and keywords. Take control of your social media experience by removing spam, engagement bait, and unwanted content with a seamless, native-looking interface.

## ✨ Features

### Core Filtering

- **Custom Keyword Filtering**: Hide posts containing specific words or phrases
- **Video Post Filtering**: Hide all video tweets
- **Link Filtering**: Hide posts with external links
- **Retweet Filtering**: Hide all retweets from your feed
- **Verified User Filtering**: Hide posts from verified accounts
- **Engagement Bait Detection**: Automatically detect and hide common engagement bait patterns
- **Advanced Ad Detection**: Intelligently detect and filter promoted/sponsored content

### Smart Exceptions

- **Username Exceptions**: Never filter posts from specific users you follow
- **Following-Only Exception**: Exempt all posts from users you follow
- **Flexible Override**: Exceptions take priority over all filter rules

### Display Options

- **Seamless UI Integration**: Filter indicators blend perfectly with X's native design
- **Show with Indicator**: Display filtered posts with a subtle notice and control options
- **Completely Hide**: Optionally hide filtered posts entirely without any indication
- **Temporary Show/Hide**: Reveal filtered posts temporarily with one-click controls

### Management Features

- **Toggle Filters**: Easily enable/disable filters without deleting them
- **Real-time Filtering**: Automatically filters new posts as they load
- **Smart Processing**: Efficient filtering that doesn't impact X's performance
- **Cross-device Sync**: Settings sync across your Chrome browsers

## 🚀 Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select this project directory
5. The extension icon will appear in your browser toolbar

## 📋 How to Use

### Setting Up Filters

1. **Navigate to Twitter/X**: Go to twitter.com or x.com
2. **Open Extension**: Click on the X Feed Filter icon in your browser toolbar
3. **Add Filters**:
   - Choose filter type:
     - **Keywords**: Hide posts containing specific words/phrases
     - **Video Posts**: Hide all tweets with videos
     - **Posts with Links**: Hide tweets containing external links
     - **Retweets**: Hide all retweets
     - **Verified Users**: Hide posts from verified accounts
     - **Engagement Bait**: Hide posts with engagement-seeking language
     - **Ads & Promoted Posts**: Hide sponsored and promoted content
   - For keyword filters, add comma-separated keywords
4. **Configure Exceptions** (optional):
   - Add usernames that should never be filtered (e.g., @username)
   - Enable "Following Only" to exempt all users you follow
5. **Choose Display Mode**:
   - **Default**: Show filter indicators for hidden posts
   - **Completely Hide**: Hide filtered posts entirely

### Managing Your Experience

- **Toggle Filters**: Use the switches to enable/disable specific filters
- **Temporary Show**: Click "Show Temporarily" on filtered posts to reveal them
- **Remove Filters**: Delete filters you no longer need
- **Update Exceptions**: Add or remove username exceptions anytime

## 🔧 Filter Types Explained

### Keywords Filter

Hide posts containing specific words or phrases. Perfect for:

- Blocking spam keywords (crypto, NFT, etc.)
- Hiding posts about topics you don't want to see
- Filtering out promotional content
- Removing spoilers or sensitive topics

**Example keywords**: `crypto, bitcoin, sponsored, giveaway, follow for follow`

### Video Posts Filter

Hides all tweets containing videos. Useful for:

- Reducing data usage on mobile
- Maintaining focus on text-based content
- Avoiding auto-playing media

### Engagement Bait Filter

Automatically detects and hides posts with common engagement bait patterns:

- "Like if you agree"
- "Retweet if..."
- "Am I the only one who..."
- "Unpopular opinion"
- "Hot take"
- "Change my mind"
- "This will probably get me cancelled"

### Ads & Promoted Posts Filter

Intelligently detects sponsored content using multiple methods:

- Official "Promoted" indicators
- Promotional context clues
- Tracking URLs
- Sponsored content patterns

### Links Filter

Hides posts containing external links (excluding X internal links)

### Retweets Filter

Hides all retweets from your timeline, keeping only original posts

### Verified Users Filter

Hides posts from verified accounts (useful for reducing noise from high-profile accounts)

## 🛡️ Smart Exceptions System

### Username Exceptions

Add specific usernames (with or without @) to never filter their posts:

- `elonmusk` or `@elonmusk`
- `twitter` or `@twitter`
- Multiple usernames supported

### Following Exception

Enable this to automatically exempt all users you follow from filtering. Great for:

- Keeping posts from friends and accounts you care about
- Only filtering unknown/promotional accounts
- Maintaining your curated follow list experience

## 🎨 Seamless UI Design

The extension is designed to blend perfectly with X's interface:

- **Native Look**: Filter indicators match X's design language
- **No Visual Disruption**: No boxes, borders, or jarring colors
- **Subtle Notifications**: Filtered posts are marked with minimal, tasteful indicators
- **Consistent Spacing**: Proper alignment with X's content structure
- **Theme Adaptive**: Automatically adapts to light and dark modes

## 🛠️ Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions**:
  - `storage`: Save your filter preferences and exceptions
  - `activeTab`: Access X pages to apply filters
- **Content Script**: Runs on twitter.com and x.com to filter posts in real-time
- **Storage**: Uses Chrome's sync storage to save settings across devices
- **Performance**: Optimized filtering with smart caching and debouncing

## 📁 Files Structure

- `manifest.json`: Extension configuration and permissions
- `popup.html`: Extension popup interface
- `popup.js`: Popup functionality and filter management
- `content.js`: Content script that runs on X pages
- `icon16.png`, `icon48.png`, `icon128.png`: Extension icons

## 🔒 Privacy & Security

This extension:

- ✅ Only runs on X pages
- ✅ Stores filter settings locally in your browser
- ✅ Does not collect, transmit, or store any personal data
- ✅ Does not modify, delete, or interact with your tweets
- ✅ Does not access your X account or login information
- ✅ Only hides posts visually - doesn't report or delete them
- ✅ No external servers or data transmission
- ✅ Open source and transparent

## 🐛 Troubleshooting

### Extension Not Working?

- Ensure you're on twitter.com or x.com
- Try refreshing the page after adding new filters
- Check that the extension is enabled in Chrome extensions page
- Look for console errors (F12 → Console tab)

### Posts Not Being Filtered?

- Verify filters are enabled (toggle switches should be blue)
- Check keyword spelling and try variations
- Consider that exceptions might be overriding filters
- X layout changes may require extension updates

### Performance Issues?

- Reduce the number of active filters if experiencing slowdown
- Use more specific keywords instead of very broad ones
- Consider using "Completely Hide" mode for better performance
- Clear browser cache and restart if needed

### Username Exceptions Not Working?

- Try both formats: `username` and `@username`
- Check spelling and case sensitivity
- Ensure the username appears exactly as shown on X
- Note that some tweets may not have easily detectable usernames

## 🆕 Recent Updates

- **Seamless UI Design**: Completely redesigned filter indicators to blend with X's native interface
- **Smart Exceptions**: Added username and following-based exception system
- **Improved Ad Detection**: Enhanced detection of promoted and sponsored content
- **Better Performance**: Optimized filtering algorithms for faster processing
- **Theme Support**: Full support for X's light and dark themes
- **Completely Hide Option**: Added option to hide filtered posts entirely

## 🤝 Contributing

We welcome contributions! Feel free to:

- Submit bug reports and feature requests via GitHub Issues
- Create pull requests for improvements
- Suggest new filter types or detection methods
- Help improve documentation

## 📄 License

This project is open source and available under the MIT License.
