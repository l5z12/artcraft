# Continuous integration

`.github/workflows/ci.yml` runs on pull requests, pushes to the main and release
branches, and manual dispatch. It uses read-only repository permissions and needs
no provider accounts, release credentials, or paid services.

The Linux frontend job installs the lockfile, runs the frontend unit tests and
Unix launcher regressions, builds the desktop frontend, and runs browser checks
against both Vite development and production preview servers. Browser checks
cover optional login, offline startup, billing preferences, and local scene
save/open with embedded assets and keyboard shortcuts. Native IPC is mocked in
the browser; external requests are blocked. The scene browser check uses Vite
source imports to exercise tab teardown and runs against development only.

The Linux (Ubuntu 24.04), Windows, and macOS jobs check the desktop Rust library
and run the identity, HTTP policy, and local scene file tests. SQLite uses the
checked-in `.sqlx` cache with `SQLX_OFFLINE=true`. After the tests, each native job
builds the release executable, installers, and a ZIP of the executable or macOS
application bundle. Both Apple Silicon and Intel Macs have native jobs.

## Download builds

Open a successful **Desktop CI** run in GitHub Actions and scroll to **Artifacts**.
Build artifacts are retained for 14 days, including on pull requests and manual
runs. Installer and binary ZIP artifacts are separate:

| Platform            | Installer artifact                | Contents            | Binary artifact                 |
|---------------------|-----------------------------------|---------------------|---------------------------------|
| Linux x64           | `artcraft-installers-linux-x64`   | `.deb`, `.AppImage` | `artcraft-binaries-linux-x64`   |
| Windows x64         | `artcraft-installers-windows-x64` | NSIS `.exe`, `.msi` | `artcraft-binaries-windows-x64` |
| macOS Apple Silicon | `artcraft-installers-macos-arm64` | `.dmg`              | `artcraft-binaries-macos-arm64` |
| macOS Intel         | `artcraft-installers-macos-x64`   | `.dmg`              | `artcraft-binaries-macos-x64`   |

Each binary artifact contains `ArtCraft-<platform>.zip`: an executable on Windows
and Linux, or an `.app` bundle on macOS, plus the original `LICENSE.md`.
Installers also include the license as an application resource. The Linux ZIP
preserves executable permissions; use `chmod +x artcraft` if your extraction tool
discards them. The bare Linux executable requires the system GTK/WebKitGTK and
GStreamer runtime libraries; the Windows executable requires WebView2. Installers
handle runtime dependencies, and the AppImage bundles the media framework.
Linux builds target Ubuntu 24.04's system libraries, so older distributions are
not guaranteed to run them.

These are CI builds: Windows installers are unsigned and macOS bundles use an
[ad-hoc signature](https://v2.tauri.app/distribute/sign/macos/#ad-hoc-signing),
without notarization. The operating system may require approval to open them.
The existing release workflows handle release signing and publishing.

`artcraft-frontend` contains the production frontend build, which every native
job downloads and embeds. The CI-only `tauri.ci.conf.json` overlay skips rebuilding
that tested frontend and disables updater artifacts. The workflow pins the Tauri
CLI version and passes `--locked` to Cargo. Missing build outputs fail artifact
upload instead of silently producing an empty download.

## Checks and dependencies

The Linux native job installs [Tauri's Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux),
including GTK/WebKitGTK and AppIndicator development libraries, plus the
CMake, Clang/LLVM, Perl, and NASM tools needed by the HTTP client's BoringSSL build.

The Windows native job pins CMake 4.4.4 and passes the installed executable's
absolute path to Cargo through `CMAKE`. This avoids an older CMake taking
precedence on `PATH`. Setup checks for the Visual Studio 2026 generator before compilation;
[that generator requires CMake 4.2 or later](https://cmake.org/cmake/help/latest/generator/Visual%20Studio%2018%202026.html).

Run the frontend checks from `frontend/` with Node 24:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run test:unit
npm run test:launcher # Linux/macOS only
npm run build:desktop
npx --no-install playwright install chromium
PLAYWRIGHT_CHANNEL=chromium npm run test:browser
PLAYWRIGHT_CHANNEL=chromium npm run test:browser:production
```

On PowerShell, use `$env:PLAYWRIGHT_CHANNEL = "chromium"` before running the
browser commands. Without that variable, the checks use installed Google Chrome.
Both browser commands start and close their own local server. Unit reports and
browser failure screenshots/HTML are saved in `frontend/test-results/` and
uploaded as a seven-day CI artifact.

Unit discovery covers the desktop app and shared library source trees. The old
Jest API tests under `frontend/apps/artcraft/test/` reference the removed web app
and are outside this Vitest suite.

For native checks, install the platform dependencies listed in the workflow and
run its Cargo commands from the repository root with `SQLX_OFFLINE=true`.
Application dependency installs and Cargo checks use committed lockfiles. Full-project
TypeScript checking is not a CI gate yet because the current repository has
pre-existing type errors; the frontend build is a bundling check, not a full type
check.
