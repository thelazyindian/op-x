# 🐦 Twitter Feed Filter

A powerful Chrome extension that lets you filter your Twitter (X) feed by hiding posts based on custom rules and keywords. Take control of your social media experience by removing spam, engagement bait, and unwanted content.

## ✨ Features

- **Custom Keyword Filtering**: Hide posts containing specific words or phrases
- **Video Post Filtering**: Hide all video tweets
- **Link Filtering**: Hide posts with external links
- **Retweet Filtering**: Hide all retweets from your feed
- **Verified User Filtering**: Hide posts from verified accounts
- **Engagement Bait Detection**: Automatically detect and hide common engagement bait patterns
- **Toggle Filters**: Easily enable/disable filters without deleting them
- **Show Hidden Posts**: Option to reveal hidden posts if you want to see them
- **Real-time Filtering**: Automatically filters new posts as they load

## 🚀 Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select this project directory
5. The extension icon will appear in your browser toolbar

## 📋 How to Use

1. **Navigate to Twitter/X**: Go to twitter.com or x.com
2. **Open Extension**: Click on the Twitter Feed Filter icon in your browser toolbar
3. **Add Filters**:
   - Enter a filter name (e.g., "Hide Spam Posts")
   - Add a description of what the filter does
   - Choose filter type:
     - **Keywords**: Hide posts containing specific words/phrases
     - **Video Posts**: Hide all tweets with videos
     - **Posts with Links**: Hide tweets containing external links
     - **Retweets**: Hide all retweets
     - **Verified Users**: Hide posts from verified accounts
     - **Engagement Bait**: Hide posts with engagement-seeking language
   - For keyword filters, add comma-separated keywords
4. **Manage Filters**: Toggle filters on/off or remove them entirely
5. **View Results**: Hidden posts will be replaced with a notice, with option to show if needed

## 🔧 Filter Types Explained

### Keywords Filter

Hide posts containing specific words or phrases. Great for:

- Blocking spam keywords
- Hiding posts about topics you don't want to see
- Filtering out promotional content

### Video Posts Filter

Hides all tweets containing videos. Useful if you:

- Want to reduce data usage
- Prefer text-based content
- Find videos distracting

### Engagement Bait Filter

Automatically detects and hides posts with common engagement bait patterns like:

- "Like if you agree"
- "Retweet if..."
- "Am I the only one who..."
- "Unpopular opinion"
- "Hot take"

### Links Filter

Hides posts containing external links (excluding Twitter/X links)

### Retweets Filter

Hides all retweets from your timeline

### Verified Users Filter

Hides posts from verified accounts

## 🛠️ Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions**:
  - `storage`: Save your filter preferences
  - `activeTab`: Access Twitter/X pages to apply filters
- **Content Script**: Runs on twitter.com and x.com to filter posts in real-time
- **Storage**: Uses Chrome's sync storage to save filters across devices

## 📁 Files Structure

- `manifest.json`: Extension configuration and permissions
- `popup.html`: Extension popup interface
- `popup.js`: Popup functionality and filter management
- `content.js`: Content script that runs on Twitter/X pages
- `icon16.png`, `icon48.png`, `icon128.png`: Extension icons

## 🔒 Privacy

This extension:

- ✅ Only runs on Twitter/X pages
- ✅ Stores filter settings locally in your browser
- ✅ Does not collect or transmit any personal data
- ✅ Does not modify or interact with your tweets or account
- ✅ Only hides posts visually - doesn't delete or report them

## 🐛 Troubleshooting

**Extension not working?**

- Make sure you're on twitter.com or x.com
- Try refreshing the page after adding filters
- Check browser console for any errors

**Posts not being filtered?**

- Ensure filters are enabled (toggle switch should be blue)
- Check that keywords are spelled correctly
- Twitter's layout changes may require extension updates

**Performance issues?**

- Try reducing the number of active filters
- Consider using more specific keywords instead of very broad ones

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests to improve this extension!

## 📄 License

This project is open source and available under the MIT License.
