# Linkscape

Linkscape is a local-first Chrome and Edge extension for saving, organizing, searching, and protecting visual collections of websites. It combines fast capture with an offline personal archive and an optional encrypted Vault.

The project is release-candidate software. Core workflows, data safety, Vault boundaries, permission minimization, and production packaging are covered by automated tests and browser-level smoke checks. Store account setup, listing assets, policy declarations, and final human QA remain external release tasks.

## Shipped Features

- Quick-save popup with recent destinations, proactive duplicate warnings, Undo, notes, tags, locally cached media when permitted, and optional offline reading snapshots.
- Direct save to an existing collection or a newly created collection.
- Context-menu destinations and configurable Chrome keyboard commands.
- Unlimited collections with title, description, icon, theme, pin, favorite, archive, duplicate, protection, ordering, and visible nesting.
- Visual cards with open, edit notes, tags, labels, move, duplicate, archive/restore, Trash/Restore, permanent delete, selection, reorder, drag-to-move, snapshot viewing, and link-health status.
- Spotlight-style fuzzy search across collections, URLs, titles, notes, tags, and labels, including arrow-key navigation plus domain, date, tag, and result-type filters.
- Bulk move, tag, archive, delete, and CSV export.
- Validated JSON backup and atomic restore with import previews, an automatic pre-import checkpoint, and five rolling local recovery points.
- CSV import/export with spreadsheet-injection protection and hierarchy-preserving Chrome, Edge, and Firefox bookmark HTML import/export.
- On-demand broken-link checks request optional access only to the saved website origins included in a user-started scan. Access can be removed from Settings.
- Vault Mode with AES-GCM encrypted links and collection metadata, PBKDF2 password and recovery verification, shared session locking, inactivity auto-lock, manual lock, and clean reset.
- Offline-first IndexedDB storage through Dexie, with an explicit schema migration path.

## Current Boundaries

- Public sharing links, cloud sync, billing, AI, collaboration, and mobile apps are future architecture only and must not be advertised as shipped.
- Smart collection rules have data support and a seeded example but no general-purpose rule-builder UI.
- Reading snapshots intentionally remove scripts, forms, embedded media, external styles, and tracking-capable resources; they are safe readable copies rather than pixel-perfect page archives.
- Image caching is best effort under the active tab permission. Cross-origin media that cannot be fetched safely remains a remote URL.
- Recovery questions are easier to guess than one-time recovery codes. New records use PBKDF2; legacy SHA-256 recovery verifiers remain supported only for migration.
- Very large masonry collections are not virtualized while drag-and-drop is active.

## Architecture

```text
src/
  components/          Shared UI primitives and error boundary
  dashboard/           Main archive, search, card, bulk, Settings, and Vault UI
  data/                Dexie database and repository boundary
  extension/           Manifest V3 service worker
  popup/               Explicit active-tab capture workflow
  services/            Capture, search, crypto, backup, health, import/export, entitlement, and sync contracts
  snapshot/            Sandboxed offline reading-snapshot viewer
  shared/              Types, constants, and utilities
  store/               Zustand application state
  styles/              Tailwind and locally bundled fonts
tests/                 Vitest regression tests
public/manifest.json   Chrome/Edge Manifest V3 manifest
```

All persistent operations pass through `src/data/repositories.ts`. Website URLs are restricted to HTTP(S), imports are prevalidated, protected/unprotected moves preserve encryption boundaries, and backup replacement happens in one IndexedDB transaction.

## Vault Model

- AES-GCM protects link content and collection display metadata.
- PBKDF2-SHA-256 verifies new master passwords and recovery answers.
- A separate data key is wrapped by the password and recovery-derived keys.
- The unlocked data key is stored only in Chrome's memory-backed `storage.session` for trusted extension contexts.
- Manual lock, inactivity expiry, browser restart, or clean reset clears the shared session.
- Existing protected records are migrated to the stronger metadata format after a successful unlock.

Vault Mode is local encryption at rest, not an operating-system password manager. Someone controlling an unlocked browser profile or device can access content while the Vault is unlocked.

## Permissions

- `activeTab`: temporary current-page access after an explicit user action.
- `scripting`: title, favicon, and preview capture during that action.
- `contextMenus`: direct save destinations.
- `storage`: temporary Vault session coordination between trusted extension pages.
- `alarms`: schedules a daily local recovery point.
- Optional website access: requested only for the exact saved website origins included when the user starts an on-demand broken-link scan, and removable from Settings.

Linkscape installs without persistent host access, has no always-running page content script, analytics SDK, or remote executable code. Fonts are packaged locally.

## Development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run lint
npm run test
npm run build
npm audit
```

The production build is written to `dist/` with source maps disabled.
On Windows with Microsoft Edge installed, `npm run smoke:edge` loads `dist/` into a clean hidden Chromium profile and checks desktop/mobile routes plus runtime errors. Current branded Chrome builds no longer support command-line loading of unpacked extensions, so the release checklist also requires a manual clean-profile Chrome pass.
`npm run assets:store` creates five deterministic 1280x800 screenshots from fictional showcase data in a temporary browser profile. Store artwork is kept in `store-assets/` and is never included in the extension package.

## Load Unpacked

1. Run `npm run build`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode.
4. Choose **Load unpacked** and select `dist`.
5. Reload the extension after rebuilding.

## Keyboard Commands

- `Ctrl+Shift+S`: save the current page.
- `Ctrl+Shift+K`: open Spotlight globally; use `Ctrl+K` inside the dashboard.
- `Ctrl+Shift+L`: lock Vault globally; use `Ctrl+L` inside the dashboard.

Users can change global assignments from `chrome://extensions/shortcuts`.

## Publishing

- Follow [STORE_SUBMISSION.md](STORE_SUBMISSION.md) for build, permission, disclosure, asset, and manual QA instructions.
- Public privacy policy: https://shivenpatro.github.io/Linkscape-Extension/privacy/
- Public product and support page: https://shivenpatro.github.io/Linkscape-Extension/
- Zip the contents inside `dist/`, not the repository or the enclosing `dist` folder.
- Never commit or upload real backups, browser profiles, `.env` files, passwords, recovery answers, private keys, or signing material.

## Security

Please report suspected vulnerabilities privately using [SECURITY.md](SECURITY.md). Do not include real browsing data or Vault credentials in reports.

## License

No open-source license has been selected. All rights remain with the repository owner unless a license is added later.
