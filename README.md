# Eagle Plugin for Obsidian

This plugin uploads images to [Eagle](https://eagle.cool/) instead of storing them locally in your vault.

## Why?

Obsidian stores all the data locally by design
(which is perfect for text and, in my opinion, can be improved for images).
If you often add pictures to your notes, your vault can quickly grow in size.
Which in turn can lead to reaching limits if you use free plans of cloud storage services to sync your notes
or can lead to growth of repository size if you use git to back up your notes.

This plugin is a perfect solution for people
who paste images to their notes on daily basis (i.e. students making screenshots of lecture slides)
and do not want to clutter their vaults with image files.

Having images managed by Eagle also makes it easier to organize and search your images
using Eagle's powerful tagging and categorization features.

## Features

- Upload images to Eagle automatically
- Upload images by either pasting from the clipboard or by dragging them from the file system
- Animated gifs upload support on drag-and-drop
- Integration with Eagle's library management system

## Installation

Install the plugin via the [Community Plugins](https://help.obsidian.md/Advanced+topics/Third-party+plugins#Discover+and+install+community+plugins) tab within Obsidian

## Getting started

### Prerequisites

1. Install and run [Eagle](https://eagle.cool/)
2. Make sure Eagle is running on your system

### Configuration

Go to plugin settings and configure:

- **Eagle API Host**: The host for your running Eagle instance (default: `localhost`)
- **Eagle API Port**: The port for your running Eagle instance (default: `41595`)
- **Eagle Folder Name**: (Optional) The folder name in Eagle where images will be saved. Leave empty to save to the default folder.

That's all! Now you are ready to make notes and upload all your images to Eagle.

## FAQ

**Q:** How secure is this approach?  
**A:** All images are stored locally in your Eagle library, which you control completely.

**Q:** Can I remove an image uploaded by accident?  
**A:** Yes, you can manage all uploaded images through the Eagle application.

**Q:** Can it upload videos?  
**A:** Currently, the plugin focuses on image uploads. Video support may be added in the future.

### Discussion

If you have any questions/suggestions, consider using [GitHub Discussions](https://github.com/GoBeromsu/obsidian-eagle-plugin/discussions).

### Known limitations

- You cannot paste animated gifs from the clipboard (they initially get copied as static images to the clipboard).
  Use drag and drop instead if you want to upload an animated gif.
- Eagle must be running for the plugin to work.

### Contribution

Contributions are welcomed.
Check out the [DEVELOPMENT.md](DEVELOPMENT.md) to get started with the code.

### Your support

If this plugin is helpful to you, you can show your ❤️ by giving it a star ⭐️ on GitHub.

### Credits

Originally forked from [gavvvr/obsidian-imgur-plugin](https://github.com/gavvvr/obsidian-imgur-plugin) and adapted for Eagle integration.
