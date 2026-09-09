# Recallry Web Store Listing

## Product Details

**Name:** Recallry - Visual Web Collections

**Category:** Productivity

**Summary:** Save websites instantly, organize visual collections, and find anything later with private local-first storage.

## Detailed Description

Recallry turns useful websites into a visual, searchable archive that stays on your device.

Save the current page in seconds, choose a recent collection, add notes and tags, and continue browsing. Recallry captures useful page metadata and keeps a local thumbnail when the browser permits it. Duplicate warnings and Undo help prevent clutter and mistakes.

Organize saved links into visual collections with nesting, pinning, favorites, archive, drag and drop, bulk actions, labels, and Trash. Spotlight-style search finds collections and links across titles, URLs, domains, notes, tags, and labels, with keyboard navigation and focused filters.

Recallry is offline-first. Collections are stored in IndexedDB in your browser profile. Export JSON backups, CSV files, or bookmark HTML; preview imports before applying them; restore local recovery points; and save safe reading snapshots for selected pages.

Vault Mode protects selected collections with AES-GCM encryption. A master password unlocks the Vault, recovery questions can reset a forgotten password, and manual or inactivity locking closes access across extension views.

Optional link-health checks can identify missing pages. Recallry requests access only to the saved website origins included when you start a scan, and that access can be removed from Settings.

Recallry contains no ads, analytics, tracking SDKs, or remote executable code. It does not sell browsing data or send your archive to the developer.

## Single Purpose

Recallry lets users explicitly save, organize, search, protect, import, and export website references as private local visual collections.

## Permission Justifications

- **activeTab:** Read the current page URL and metadata after the user opens Recallry or invokes a save command.
- **scripting:** Extract title, favicon, and available preview-image metadata during explicit capture. No script runs continuously.
- **contextMenus:** Save pages or links directly to a selected local collection.
- **storage:** Coordinate the temporary, memory-backed Vault session between trusted extension pages.
- **alarms:** Create a daily recovery point in the extension's local IndexedDB database.
- **Optional website access:** Check only the exact saved website origins included in a user-started link-health scan. This permission is not required at installation and can be removed from Settings.

## Privacy Disclosures

- **Website content:** Page title, URL, favicon, preview metadata, and optional reading snapshot are processed only when the user saves a page.
- **Web history / browsing activity:** Saved URLs are stored because collecting those references is the extension's user-facing purpose. Recallry does not monitor general browsing history.
- **User-generated content:** Collection names, descriptions, notes, tags, labels, imports, and settings are stored locally.
- **Data use:** Data is used only to provide Recallry's collection-management features. It is not sold, used for advertising, credit decisions, or unrelated profiling, and is not transferred to the developer.
- **Remote code:** No. All executable code and fonts are packaged with the extension.

## Public URLs

- **Homepage:** https://shivenpatro.github.io/Recallry-Extension/
- **Privacy policy:** https://shivenpatro.github.io/Recallry-Extension/privacy/
- **Support:** https://github.com/shivenpatro/Recallry-Extension/issues
- **Security reports:** https://github.com/shivenpatro/Recallry-Extension/security/policy

## Reviewer Notes

1. Open the extension popup on a normal HTTP(S) page and save it to Inbox.
2. Open the dashboard and select Inbox to view the saved card.
3. Open Settings to test backup export/import, recovery points, and the optional link-health permission flow.
4. Open Vault, set a password and recovery question, then use a collection menu to lock that collection.
5. Lock Vault and confirm the protected collection routes to the unlock screen from both the grid and sidebar.

Link-health checks require a saved HTTP(S) link and request origin access only when the reviewer starts the scan. No account or network service is required for ordinary use.

## Release Notes 1.0.0

- Visual local-first collections with fast popup and context-menu capture.
- Spotlight search, nesting, tags, labels, drag and drop, bulk actions, archive, and Trash.
- Import/export, validated backups, rolling local recovery points, cached media, and safe reading snapshots.
- AES-GCM Vault with password recovery, manual lock, and inactivity auto-lock.
- Optional least-privilege link-health scans with removable website access.
