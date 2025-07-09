# Eagle

An Obsidian plugin that integrates with the [Eagle App](https://eagle.cool) to upload and manage images directly from your notes.

## Features

- 🔗 **Eagle API Integration**: Seamless connection to your local Eagle app
- 📸 **Clipboard Image Upload**: Automatic image upload from paste events
- ⚙️ **Simplified Settings**: Minimal configuration with connection testing
- 🎯 **Health Check**: One-click Eagle connection verification
- 🎨 **Clean UI**: Modern interface with icon-based confirmations
- ✅ **Smart Upload Confirmation**: Optional dialog with "don't ask again" option

## Prerequisites

- [Eagle App](https://eagle.cool) (version 1.11 Build21 or later)
- Eagle app must be running for API access
- Obsidian desktop app

## Installation

### Manual Installation

1. Download or clone this repository
2. Copy the plugin folder to your Obsidian vault's `.obsidian/plugins/` directory
3. Enable the plugin in Obsidian Settings → Community Plugins

### BRAT Installation

1. Install the [BRAT plugin](obsidian://show-plugin?id=obsidian42-brat)
2. Add this repository: `your-username/obsidian-eagle-plugin`
3. Enable the plugin in Community Plugins

## Configuration

1. Open Obsidian Settings → Eagle
2. Configure basic settings:
   - **Vault Path**: Absolute path to your Obsidian vault for temporary file storage
   - **Show upload confirmation**: Enable/disable confirmation dialog before upload
3. Test your connection using the "Test Connection" button

The plugin automatically connects to Eagle at `http://localhost:41595` (Eagle's standard API endpoint).

## Usage

### Image Upload

- Copy an image to your clipboard and paste it in any Obsidian note
- The plugin will show a confirmation dialog with icon-based Yes/No buttons
- Choose "Upload" (✅) to upload to Eagle or "Cancel" (❌) to skip
- Check "Always upload without asking" to disable future confirmations
- The plugin inserts a markdown image link pointing to the Eagle thumbnail
- Images are temporarily stored in a `.eagle-temp` folder within your vault

### Quick Health Check

- Click the Eagle icon in the ribbon bar to test connection
- Use Command Palette: "Eagle: Test Eagle Connection"

### Settings Overview

**Eagle Connection**

- One-click connection testing with live status feedback
- Automatic API endpoint detection (no manual URL configuration needed)

**Upload Behavior**

- Toggle upload confirmation dialog
- Path configuration for temporary file storage

## Technical Details

- **Eagle API**: Uses Eagle's local API at `localhost:41595`
- **No Authentication**: Eagle API runs locally without authentication
- **TypeScript**: Fully typed for better development experience
- **Modular Design**: Clean separation of concerns following best practices
- **Temporary Storage**: Images stored temporarily in `.eagle-temp` folder for Eagle access
- **Error Handling**: Comprehensive error handling with user-friendly notifications

## Code Organization

The plugin follows a clean, modular architecture:

- `src/main.ts` - Plugin entry point and event handling
- `src/eagle/EagleClient.ts` - Eagle API communication
- `src/uploader/` - Image upload logic and factory pattern
- `src/ui/` - User interface components (settings, modals)
- `src/types/` - TypeScript interfaces and type definitions
- `src/utils/` - Utility functions for file handling

## Troubleshooting

### Connection Issues

1. **"Cannot connect to Eagle app"**

   - Ensure Eagle app is running
   - Verify Eagle version (1.11 Build21+ required)
   - Eagle API runs on port 41595 by default

2. **Network Issues**
   - Eagle API only works locally (localhost)
   - Check firewall settings if necessary

### Upload Issues

1. **Images not uploading**

   - Check that Eagle app is running and accessible
   - Ensure vault path is correctly configured in settings
   - Verify upload confirmation is not blocking the process

2. **Temporary files not cleaned up**
   - Check `.eagle-temp` folder in your vault
   - Manually delete temporary files if needed

### Getting Help

- [Eagle API Documentation](https://api.eagle.cool)
- [Eagle Plugin Development Guide](https://developer.eagle.cool)
- [Report Issues](../../issues)

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Eagle App](https://eagle.cool) for the excellent image management software
- Obsidian community for plugin development support
