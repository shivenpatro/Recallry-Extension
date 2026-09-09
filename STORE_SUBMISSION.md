# Chrome Web Store Submission

## Publisher Account Setup

1. Register the publisher in the Chrome Web Store Developer Dashboard and pay Google's one-time developer registration fee.
2. Enable 2-Step Verification on the owning Google Account.
3. Set the public publisher name, verify a frequently monitored support email, and enable review/publication notifications.
4. Complete the required Trader or Non-Trader declaration based on your legal circumstances. If classified as a Trader, review which verified contact details Google will display publicly.
5. Keep the first release free. A physical business address becomes an account requirement if Recallry later offers purchases, paid features, or subscriptions.

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

Every push to `main` also runs the public `Recallry release checks` workflow. Download the `recallry-chrome-<commit>` artifact only after both the verification and Edge smoke-test jobs pass.

## Single Purpose

Recallry lets users explicitly save, organize, search, protect, import, and export website references as local visual collections.

## Permission Justifications

- `activeTab`: reads the active page URL and metadata only when the user opens Recallry or invokes a save command.
- `scripting`: extracts the title, favicon, and available Open Graph/Twitter preview image during an explicit capture action. No script runs continuously.
- `contextMenus`: lets users save pages and links directly to a chosen local collection.
- `storage`: stores the temporary memory-backed Vault session so dashboard, popup, and service worker agree on lock state.
- `alarms`: creates a daily recovery point inside the extension's local IndexedDB database.
- Optional website access: requested from Settings only for the exact saved website origins included in a user-started link-health scan. It is not required for install or ordinary capture, and the user can remove it from Settings.

The extension installs without persistent host permissions, has no remote executable code, and has no content script matched to every website.

## Data-Use Disclosure

In the Privacy tab, disclose:

- Website content and browsing activity because Recallry processes URLs, titles, and page metadata for the user-requested save workflow.
- User-generated content because notes, tags, labels, collection names, and imports are stored locally.
- Authentication information because Vault passwords and recovery answers are processed locally to derive encryption keys. Raw secrets are not stored or transmitted.

State that these categories are used only for the extension's single purpose, are not sold, are not used for advertising or credit decisions, and are not transferred to the developer in the current release. Certify compliance with the Chrome Web Store Limited Use requirements. Select **No** for remote code.

Use these stable public URLs in the listing:

- Privacy policy: https://shivenpatro.github.io/Recallry-Extension/privacy/
- Homepage: https://shivenpatro.github.io/Recallry-Extension/
- Support: https://github.com/shivenpatro/Recallry-Extension/issues

### One-Time GitHub Pages Setup

GitHub requires a repository owner to enable Pages before these URLs become public. In the repository, open **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/docs**, then save. Wait for the Pages deployment to complete and verify both the homepage and privacy-policy URL before submitting the extension.

## Listing Assets

- 128×128 extension icon.
- At least one 1280×800 or 640×400 screenshot; use 1280×800 for clarity.
- 440×280 small promotional tile.
- Optional 1400×560 marquee image.
- Support URL and support email.

Do not advertise cloud sync, public sharing links, collaboration, billing, AI categorization, or mobile apps until those systems ship.

## Recommended First-Publication Sequence

1. Upload the verified ZIP with `manifest.json` at its root.
2. Complete Package, Store Listing, Privacy, Distribution, and support details. Reviewer instructions are optional because Recallry needs no credentials, but the prepared reviewer notes can shorten evaluation.
3. Initially choose **Unlisted** visibility so the approved Chrome Web Store build can be installed from its direct URL without announcing it publicly.
4. Submit for review using deferred publishing when available. All visibility levels receive the same policy review.
5. After approval, install the Web Store build in a clean Chrome profile and complete every manual QA item below.
6. Change visibility to **Public**, republish as required by the dashboard, and confirm the public listing before sharing it on LinkedIn.
7. Do not create a second beta listing unless its name and description clearly identify it as a development or beta build.

## Manual Release QA

1. Install the clean `dist/` build in a new Chrome profile. Confirm Recallry opens without a login, creates the starter collections, and clearly presents its local-first behavior.
2. Save normal pages from the popup, keyboard command, and context menu.
3. Confirm restricted pages show a clear error and never create placeholder data.
4. Exercise collection edit, duplicate, reorder, nesting, favorite, archive, protection, Trash, Restore, and permanent deletion.
5. Add a card without a preview and verify selection, drag, actions, archive, restore, move, labels, Trash, and permanent deletion.
6. Import representative Chrome, Edge, Firefox, CSV, and Recallry backup files. Verify previews, reject malformed files, and restore an automatic recovery point.
7. Create a Vault, configure recovery, protect a populated collection, lock it, and verify dashboard, sidebar, popup, search, and keyboard access remain blocked.
8. Unlock in the dashboard and save to a protected collection from the popup. Confirm manual and inactivity locking affect every extension page.
9. Restart the browser and verify the Vault starts locked while unprotected data remains available offline.
10. Inspect the service worker and dashboard consoles for errors and run an accessibility keyboard pass.
11. Save an offline snapshot, disconnect the network, and verify its sandboxed reader opens without external requests.
12. Start a link-health scan, review the optional permission prompt, and confirm denied access produces no scan.
13. Remove link-health access from Settings, then confirm another scan asks only for the origins currently represented by saved links.
14. Export a JSON backup from one clean browser profile, import it into a second clean profile, and verify collections, cards, nesting, settings, and Vault-protected records survive the manual device-transfer path.

## Versioning

Increment `version` in `public/manifest.json` for every uploaded package. Keep database migrations backward-compatible and test an upgrade from the previously published version before rollout.
