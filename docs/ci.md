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
checked-in `.sqlx` cache with `SQLX_OFFLINE=true`. These jobs do not sign or
publish builds; the existing release workflows handle publishing.

The Linux native job installs [Tauri's Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux),
including GTK/WebKitGTK and AppIndicator development libraries, plus the
CMake, Clang/LLVM, Perl, and NASM tools needed by the HTTP client's BoringSSL build.

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
All dependency installs and Cargo checks use committed lockfiles. Full-project
TypeScript checking is not a CI gate yet because the current repository has
pre-existing type errors; the frontend build is a bundling check, not a full type
check.
