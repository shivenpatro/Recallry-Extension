# Linkscape

Linkscape is a local-first Chrome and Edge extension for saving, organizing, and revisiting the web as visual collections. It is designed for people who want the speed of a bookmark manager with the clarity of a personal research archive.

The project is currently in private-beta development. The core workflows are implemented and tested, but the Chrome Web Store hardening checklist in this document still needs to be completed before public release.

## What Works Today

- Quick-save popup for the active page.
- Save to an existing collection or create a new collection.
- Context-menu and keyboard-command saving.
- Page title, URL, domain, page favicon, notes, tags, and available Open Graph image capture.
- Collections with title, description, icon, theme, pin, favorite, archive, duplicate, and nested-parent support.
- Visual link cards with open, notes, tags, duplicate, delete, selection, reorder, and drag-to-move actions.
- Global fuzzy search across collections, URLs, titles, notes, tags, and labels.
- Bulk move, tag, archive, delete, and CSV export.
- JSON backup and restore.
- CSV import/export and browser bookmark HTML import/export.
- Vault Mode with AES-GCM encrypted protected links, PBKDF2 password verification for new Vaults, recovery-question password reset, configurable auto-lock, manual lock, and clean reset.
- Offline-first IndexedDB storage through Dexie.

## Current Limitations

These are intentionally documented rather than presented as completed functionality:

- Public share links and cloud sync are not implemented.
- Smart collection rules have data support but no complete rule-builder UI.
- Nested collections are stored but the sidebar is currently flat.
- Card-level move controls, undo, duplicate detection, import preview, and card restore are planned.
- Preview images are not downloaded into a local cache.
- The auto-lock timer is duration-based; full inactivity detection is planned.
- Existing legacy Vault records may still use the older SHA-256 password verifier for backward compatibility. New Vaults use PBKDF2.
- Vault protection currently encrypts link payloads. Collection metadata privacy will be strengthened before public release.

## Architecture

```text
src/
  components/          Shared UI primitives
  dashboard/           Main archive, collection, search, bulk, and Vault UI
  data/                Dexie database and repository layer
  extension/           MV3 service worker and page content script
  popup/               Quick-save popup
  services/            Capture, search, Vault crypto, import/export, sharing contracts
  shared/              Types, constants, and utility functions
  store/               Zustand application state
  styles/              Tailwind and global styling
tests/                 Vitest regression tests
public/manifest.json   Chrome/Edge Manifest V3 manifest
```

## Local Data Model

IndexedDB database: `linkscape`

- `collections`: collection identity, hierarchy, ordering, theme, status, favorite/pin state, and Vault flag.
- `links`: saved page metadata, collection membership, ordering, tags, archive state, and encrypted payload when protected.
- `tags`: normalized tag records and colors.
- `meta`: Vault settings and future sync metadata.

All repository operations go through `src/data/repositories.ts`. This keeps a future sync adapter separate from the local data layer.

## Vault Security Model

Vault Mode is local encryption at rest, not an operating-system password manager. When a Vault is unlocked, its in-memory key can be used by the running extension page. Locking clears that key from memory and protected link payloads remain encrypted in IndexedDB.

- AES-GCM protects encrypted link payloads.
- New Vault password verification uses PBKDF2-SHA-256 with the configured Vault iteration count.
- New Vaults generate a separate data key and wrap it with the master password key.
- Recovery answers wrap the same data key so a forgotten password can be reset without losing protected content.
- Older Vault records remain backward-compatible and should be migrated when their owner unlocks/configures recovery.
- Recovery answers should be unique and difficult to guess. A future recovery-code flow is preferable for high-value data.

Never commit real passwords, recovery answers, encrypted backups, browser profiles, or private keys to this repository.

## Permissions

The extension currently uses:

- `contextMenus`: save a page from the browser context menu.
- `tabs`: read the active tab for an explicit save action and open saved links.
- `<all_urls>` host access: run the packaged content script on pages to read title, favicon, and available preview metadata for an explicit capture workflow.

The host-access model should be reviewed before Web Store submission. The long-term preferred design is to request the narrowest active-tab access possible for user-triggered capture.

## Development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run lint
npm run test
npm run build
```

The production build is written to `dist/`. Generated output and dependencies are intentionally ignored by Git.

## Load Locally

1. Run `npm run build`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode.
4. Choose **Load unpacked**.
5. Select the `dist` directory.

After source changes, rebuild and use the extension page's reload button.

## Keyboard Commands

- `Ctrl+Shift+S`: save the current page.
- `Ctrl+K`: open Spotlight search.
- `Ctrl+L`: lock Vault Mode.

On macOS, use the corresponding Command shortcuts.

## Privacy Position

Linkscape stores collections, saved links, notes, tags, and Vault metadata locally by default. It does not require an account or cloud service. Page metadata is read only for the user's explicit save workflow. No analytics or advertising SDK is included.

Before public release, the project needs a hosted privacy policy, a final permission review, encrypted backup guidance, and Chrome/Edge end-to-end testing. Chrome Web Store disclosures must accurately describe locally processed browsing activity and user-created content.

## Release Checklist

- Keep regression coverage for all protected/unprotected move paths.
- Encrypt or otherwise minimize protected collection metadata.
- Complete the inactivity lock behavior and legacy Vault migration.
- Add delete undo, import preview, duplicate detection, and visible error states.
- Add Chrome and Edge browser tests, accessibility checks, and performance tests with large datasets.
- Review `<all_urls>` host access and remove any permission not required by the shipped feature set.
- Build with production sourcemaps disabled for the submitted artifact.
- Prepare store screenshots, support URL, privacy policy, permission justifications, and test instructions.

## License

No open-source license has been selected yet. Add one before accepting external contributions or publishing a reusable package.
