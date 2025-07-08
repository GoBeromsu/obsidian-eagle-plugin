# Obsidian Eagle Plugin

An Obsidian plugin that integrates with the [Eagle App](https://eagle.cool) to upload and manage images directly from your notes.

## Features

- 🔗 **Eagle API Integration**: Connect to your local Eagle app via API
- 📸 **Image Upload**: Automatic image upload from clipboard paste events
- ⚙️ **Intuitive Settings**: Easy configuration with connection testing
- 🎯 **Health Check**: One-click Eagle connection verification
- 🎨 **Clean UI**: Organized settings following modern design principles
- ✅ **Upload Confirmation**: Optional dialog before uploading images

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

1. Open Obsidian Settings → Eagle Plugin
2. Configure Eagle API connection:
   - **Eagle API URL**: Default `http://localhost:41595` (Eagle's standard API endpoint)
   - **Vault Path**: Absolute path to your Obsidian vault for temporary file storage
3. Test your connection using the "Test Connection" button
4. Configure upload behavior:
   - **Enable image upload**: Toggle automatic image upload from clipboard
   - **Show upload confirmation**: Enable/disable confirmation dialog before upload
   - **Default folder ID**: Set default Eagle folder for organized uploads (optional)

## Usage

### Image Upload

- Copy an image to your clipboard and paste it in any Obsidian note
- If upload is enabled, the image will be automatically uploaded to Eagle
- The plugin will insert a markdown image link pointing to the Eagle thumbnail
- Images are temporarily stored in a `.eagle-temp` folder within your vault

### Quick Health Check

- Click the Eagle icon in the ribbon bar to test connection
- Use Command Palette: "Eagle Plugin: Test Eagle connection"

### Settings Overview

**Eagle API Connection**

- Configure URL and port for Eagle API
- Real-time connection status display
- One-click connection testing

**Upload Behavior**

- Enable/disable automatic image upload to Eagle
- Upload confirmation preferences
- Default folder ID for organized uploads

## Development Status

🎉 **Phase 2 Complete**: Image Upload Implementation

- ✅ Eagle API client with health check
- ✅ Comprehensive settings interface
- ✅ Image upload functionality with clipboard paste support
- ✅ Upload confirmation modal with "always upload" option
- ✅ Temporary file management and cleanup
- ✅ Error handling and user feedback
- ✅ Modular architecture following best practices

🔄 **Phase 3 Planned**: Enhanced Features

- Drag-and-drop image upload support
- Canvas integration
- Upload progress tracking
- Batch image upload support

## Technical Details

- **Eagle API**: Uses Eagle's local API at `localhost:41595`
- **No Authentication**: Eagle API runs locally without authentication
- **TypeScript**: Fully typed for better development experience
- **Modular Design**: Clean separation of concerns following coding best practices
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
   - Check API URL and port settings
   - Verify Eagle version (1.11 Build21+ required)

2. **Wrong Port Number**

   - Default Eagle API port is 41595
   - Check Eagle settings if using custom port

3. **Network Issues**
   - Eagle API only works locally (localhost)
   - Check firewall settings if necessary

### Upload Issues

1. **Images not uploading**

   - Verify "Enable image upload" is turned on in settings
   - Check that Eagle app is running and accessible
   - Ensure vault path is correctly configured

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
