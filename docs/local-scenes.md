# Local 3D scenes

In the 3D Stage, use **File → Save local scene…** (`Ctrl+S`, or `Cmd+S` on
macOS) to save an `.artcraft` file. Use **File → Open local scene…**
(`Ctrl+O` / `Cmd+O`) to reopen it. These shortcuts can be changed in Settings.
No account or subscription is required. Opening asks before replacing the
current scene; canceling either dialog leaves it alone.

The file contains the scene's objects, transforms, poses, cameras, prompt,
skybox selection and animation timeline. GLB models and animation clips, SPZ
splats, PNG/JPEG/WebP/GIF images and MP4 planes are embedded in the file. Assets
that originally came from the cloud must be downloadable during the first
save. Reopening and re-saving a local file works offline, including after
switching away from the 3D tab and back.

Local saves do not upload anything. Cloud opening/saving and ArtCraft's paid
model services remain available separately. A local save of a cloud scene
does not overwrite its cloud version; opening a local file clears the cloud
scene identity.

Files are limited to 256 MB, including base64 overhead. MMD models and GLBs
with external texture/buffer files cannot currently be bundled; saving reports
an error instead of producing an incomplete file. Built-in shapes and bundled
skyboxes use the resources shipped with ArtCraft. This format is an editable
ArtCraft project, not a generic GLB export.

The format is a UTF-8 JSON envelope with `format: "artcraft-scene"`,
`formatVersion: 1`, `title` and `scene`. `scene.embeddedAssets` maps original
media IDs and image URLs to data URLs. Original IDs are preserved so poses,
animation references and optional cloud workflows remain compatible.

Native commands show the file picker themselves and expose no arbitrary-path
filesystem API. Saves write and sync a temporary file in the selected directory
before replacing an existing save.

Validation (frontend commands run from `frontend/`):

- `node node_modules/vitest/vitest.mjs run --config libs/components/pagescene/vite.config.ts`
- `node node_modules/vitest/vitest.mjs run --config libs/components/keybinds/vite.config.ts`
- `node tools/testing/local-scene.mjs <local Vite URL>` (from `frontend/`, with Chrome installed)
- `cargo test -p artcraft scene_files` (from the repository root, with desktop build prerequisites installed)

The browser regression exercises the real scene loader and serializer with
mocked native dialogs and all remote network requests blocked.
