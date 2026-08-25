# Linkscape Privacy Policy

Effective date: August 25, 2026

Linkscape is a local-first browser extension for saving and organizing websites. Linkscape does not require an account and does not operate a developer-controlled analytics, advertising, or synchronization service in the current release.

## Data Linkscape Handles

When a user explicitly saves a page, Linkscape may process the page URL, title, domain, favicon, available preview image, optional script-free reading snapshot, collection destination, notes, tags, labels, save date, and link-health result. It also stores collection settings, Trash state, local recovery points, import/export data, and Vault configuration created by the user.

This information is stored locally in the browser's IndexedDB database. Linkscape does not sell this information and does not transmit it to the developer or to advertising or analytics providers.

Linkscape attempts to cache favicon and preview images locally under the temporary active-page permission. Images that cannot be cached can retain their original address, and displaying those images may request them from the source website. Offline snapshots remove executable scripts and external loading resources. Opening a saved link navigates to the destination normally.

## Permissions

- `activeTab` grants temporary access to the current page after the user invokes Linkscape.
- `scripting` reads page metadata during that explicit save action.
- `contextMenus` adds Linkscape save destinations to the browser menu.
- `storage` keeps the temporary Vault-unlock session available only to trusted extension pages for the current browser session.
- `alarms` schedules rolling recovery points in local IndexedDB.
- Optional HTTP(S) host access is requested only when the user explicitly starts a link-health scan. It is used to check saved URLs and is not used to collect browsing history.

Linkscape installs without persistent access to all websites and does not install an always-running page content script.

## Vault Mode

Vault Mode encrypts protected link content and protected collection metadata locally with AES-GCM. Password and recovery verification for new Vaults uses PBKDF2-SHA-256. The temporary decrypted data key is held in Chrome's memory-backed extension session storage and is cleared when the Vault is locked, expires, or the browser session ends.

Vault Mode cannot protect information while the Vault is unlocked from someone who already controls the browser profile or device. Users are responsible for protecting their device, password, recovery answer, and exported backups.

## Imports, Exports, and Retention

Deleted items remain in Trash until the user permanently deletes them. Linkscape keeps up to five rolling local recovery points. Data otherwise remains in the browser profile until the user deletes it, resets Linkscape, removes extension data, or restores a different backup. Exported JSON, CSV, and HTML files are created at the user's request and are controlled by the user after download. A JSON backup can contain encrypted Vault payloads and password-verification metadata and should be treated as sensitive.

## Children

Linkscape is a general productivity tool and is not directed to children under 13.

## Changes and Contact

Material policy changes will be published with a new effective date. Privacy or security questions can be reported privately using the contact process in `SECURITY.md` in the official Linkscape repository.
