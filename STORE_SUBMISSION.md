# Chrome Web Store Submission

## Release Build

```bash
npm ci
npm run lint
npm run test
npm run build
npm run smoke:edge
npm run assets:store
npm audit
```

Review `dist/manifest.json`, then zip the contents inside `dist/`. Do not include source files, source maps, `node_modules`, browser profiles, backups, environment files, private keys, passwords, or recovery answers.

## Single Purpose

Linkscape lets users explicitly save, organize, search, protect, import, and export website references as local visual collections.

## Permission Justifications

- `activeTab`: reads the active page URL and metadata only when the user opens Linkscape or invokes a save command.
- `scripting`: extracts the title, favicon, and available Open Graph/Twitter preview image during an explicit capture action. No script runs continuously.
- `contextMenus`: lets users save pages and links directly to a chosen local collection.
- `storage`: stores the temporary memory-backed Vault session so dashboard, popup, and service worker agree on lock state.
- `alarms`: creates a daily recovery point inside the extension's local IndexedDB database.
- Optional website access: requested from Settings only for the exact saved website origins included in a user-started link-health scan. It is not required for install or ordinary capture, and the user can remove it from Settings.

The extension installs without persistent host permissions, has no remote executable code, and has no content script matched to every website.

## Data-Use Disclosure

Disclose website content and browsing activity because Linkscape processes URLs, titles, and page metadata for the user-requested save workflow. Disclose user-generated content because notes, tags, labels, collection names, and imports are stored locally. State that these categories are used only for the extension's single purpose, are not sold, are not used for advertising or credit decisions, and are not transferred to the developer in the current release.

Use these stable public URLs in the listing:

- Privacy policy: https://shivenpatro.github.io/Linkscape-Extension/privacy/
- Homepage: https://shivenpatro.github.io/Linkscape-Extension/
- Support: https://github.com/shivenpatro/Linkscape-Extension/issues

## Listing Assets

- 128×128 extension icon.
- At least one 1280×800 or 640×400 screenshot; use 1280×800 for clarity.
- 440×280 small promotional tile.
- Optional 1400×560 marquee image.
- Support URL and support email.

Do not advertise cloud sync, public sharing links, collaboration, billing, AI categorization, or mobile apps until those systems ship.

## Manual Release QA

1. Install the clean `dist/` build in a new Chrome profile.
2. Save normal pages from the popup, keyboard command, and context menu.
3. Confirm restricted pages show a clear error and never create placeholder data.
4. Exercise collection edit, duplicate, reorder, nesting, favorite, archive, protection, Trash, Restore, and permanent deletion.
5. Add a card without a preview and verify selection, drag, actions, archive, restore, move, labels, Trash, and permanent deletion.
6. Import representative Chrome, Edge, Firefox, CSV, and Linkscape backup files. Verify previews, reject malformed files, and restore an automatic recovery point.
7. Create a Vault, configure recovery, protect a populated collection, lock it, and verify dashboard, sidebar, popup, search, and keyboard access remain blocked.
8. Unlock in the dashboard and save to a protected collection from the popup. Confirm manual and inactivity locking affect every extension page.
9. Restart the browser and verify the Vault starts locked while unprotected data remains available offline.
10. Inspect the service worker and dashboard consoles for errors and run an accessibility keyboard pass.
11. Save an offline snapshot, disconnect the network, and verify its sandboxed reader opens without external requests.
12. Start a link-health scan, review the optional permission prompt, and confirm denied access produces no scan.
13. Remove link-health access from Settings, then confirm another scan asks only for the origins currently represented by saved links.

## Versioning

Increment `version` in `public/manifest.json` for every uploaded package. Keep database migrations backward-compatible and test an upgrade from the previously published version before rollout.
