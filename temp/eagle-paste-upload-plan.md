# Eagle Image Paste Upload Feature Plan

## 1. Overview of Current State Related to the Feature

- `obsidian-eagle-plugin` currently provides settings, a health-check command, and `EagleClient` for REST calls.
- Upload-related settings (`enableUpload`, `showUploadConfirmation`, `defaultFolderId`) exist but are **unused**.
- No listener intercepts paste / drag-and-drop events, and there is **no uploader implementation**.

## 2. Overview of the Final State of the Feature

When the user pastes or drags an image into Obsidian **and** `enableUpload` is `true`:

1. The plugin intercepts the event (clipboard or drag).
2. If `showUploadConfirmation` is enabled, a confirmation dialog is shown (modal).
3. Each image file is saved to a temporary location accessible by Eagle (e.g. `<vault>/.eagle-temp/<uuid>.<ext>`).
4. `EagleClient.addItemFromPath` is called with:
   - `path`: absolute temp file path
   - `name`: original file name
   - `folderId`: `settings.defaultFolderId` (omit if empty)
5. On success the returned item info (or temp path fallback) is embedded into the note as a Markdown image: `![](eagle://<item-id>)` _(exact schema to refine after API test)_.
6. On failure the original Obsidian handler is invoked so default local attachment behaviour proceeds.

Result: Users paste images and they automatically appear in Eagle’s default folder with minimal friction.

## 3. Files to Change (with Description)

- `src/uploader/ImageUploader.ts` – declare a small interface (`upload(image: File): Promise<string>`).
- `src/uploader/EagleImageUploader.ts` – implement the interface; contains logic for temp save ➜ `addItemFromPath` ➜ return link.
- `src/uploader/uploaderFactory.ts` – decide which uploader to instantiate (future-proofing).
- `src/main.ts`
  - initialize the uploader during plugin load.
  - hook **paste** and **drop** events in `MarkdownView` & `CanvasView` (pattern from Imgur plugin).
  - implement confirmation modal & fallback to default handler.
- `src/ui/` (optional) – new confirmation modal component if none exists.
- `src/utils/temp-path.ts` – helper to generate & write temp image files (uses `this.app.vault.adapter.writeBinary`).
- `types/eagle.ts` – ensure `EagleAddItemRequest` and response types are sufficient (no change expected).

## 4. Checklist of Tasks

- [ ] Create `ImageUploader` interface
  - [ ] Define strict return type (remote link string)
- [ ] Implement `EagleImageUploader`
  - [ ] Generate temp path & write binary
  - [ ] Call `EagleClient.addItemFromPath`
  - [ ] Delete temp file after successful upload (cleanup)
  - [ ] Return Eagle link or throw specific error
- [ ] Build `uploaderFactory` (single strategy for now)
- [ ] Extend `EaglePlugin` (`src/main.ts`)
  - [ ] Load uploader on `onload`
  - [ ] Add `paste` handler mirroring Imgur logic
    - [ ] Confirmation modal respecting `showUploadConfirmation`
    - [ ] Fallback to default handler on error / user cancel
  - [ ] Add `drop` handler (optional for first iteration)
- [ ] Implement simple `UploadConfirmationModal` component (if needed)
- [ ] Update settings tab descriptions if functionality changes
- [ ] Manual test: paste image ➜ appears in Eagle default folder ➜ markdown link inserted
- [ ] Optional: unit test `EagleImageUploader`

---

**Ideas / Future Enhancements (not part of minimal scope):**

- Support tagging before upload via dialog.
- Allow choosing folder dynamically if `defaultFolderId` empty.
- Progress indicator in the editor while uploading (similar to Imgur plugin’s placeholder text).
