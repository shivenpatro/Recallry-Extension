# Linkscape Privacy Policy

Effective date: August 30, 2026

Linkscape is a local-first Chrome and Edge extension for saving and organizing user-selected website references. Linkscape does not require an account and does not operate developer-controlled analytics, advertising, synchronization, or data-collection services in the current release.

## Single Purpose

Linkscape helps users explicitly save, organize, search, protect, back up, and revisit website references as private visual collections.

## Information Linkscape Processes

When a user explicitly saves a page, Linkscape may process:

- Page URL, title, domain, favicon, and available preview image.
- Notes, tags, labels, collection names, and other content entered by the user.
- Save date, collection membership, ordering, archive state, and Trash state.
- An optional script-free reading snapshot created only when the user selects that option.
- Link-health status and HTTP response status when the user explicitly starts a scan.
- Import, export, local-backup, and Vault settings initiated by the user.

Linkscape does not read or retain the user's general browsing history. It processes only pages and saved domains involved in a user-requested Linkscape action.

## Storage and Data Transfers

Collections, saved links, notes, tags, labels, snapshots, local recovery points, and Vault configuration are stored in the browser profile using IndexedDB and Chrome's memory-backed extension session storage. Linkscape does not transmit this information to the developer.

The following user-facing actions can contact third-party websites directly from the user's browser:

- Opening a saved link navigates to that website.
- A favicon or preview image that could not be cached locally may be requested from its source website when displayed.
- An on-demand link-health scan sends a `HEAD`, or limited fallback `GET`, request only to saved origins for which the user granted optional website access.

Linkscape does not include analytics, advertising, tracking pixels, or remote executable code. Linkscape does not sell user data.

## Chrome Web Store Limited Use

Linkscape's use of information received from Chrome APIs is limited to providing and improving its user-facing save, organization, search, backup, Vault, snapshot, and link-health features.

Linkscape does not use or transfer this information for personalized advertising, creditworthiness, lending, or unrelated purposes. Linkscape does not permit humans to read user data except when the user gives explicit consent for support, when required for security or legal compliance, or after the data has been aggregated and anonymized for internal operations. The current release does not transmit user data to the developer or third parties.

Linkscape's use and transfer of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Permissions

- `activeTab` grants temporary access to the current page after the user invokes Linkscape.
- `scripting` reads page metadata during that explicit save action. No script runs continuously.
- `contextMenus` adds Linkscape save destinations to the browser menu.
- `storage` keeps the temporary Vault-unlock session available only to trusted extension pages for the current browser session.
- `alarms` schedules rolling recovery points inside local IndexedDB.
- Optional HTTP(S) host access is requested only for the exact saved origins included in a user-started link-health scan. Users can deny or later remove this access in Linkscape Settings.

Linkscape installs without persistent access to every website and does not install an always-running page content script.

## Vault Mode

Vault Mode encrypts protected link content and protected collection metadata locally with AES-GCM. Password and recovery verification for new Vaults uses PBKDF2-SHA-256. The temporary decrypted data key is held in Chrome's memory-backed extension session storage and is cleared when the Vault is locked, expires, or the browser session ends.

Vault Mode protects selected data at rest. It cannot protect content while the Vault is unlocked from someone who already controls the browser profile or device. Ordinary collections and exported files are not automatically encrypted.

## Offline Snapshots

Offline reading snapshots are optional. Before storage, Linkscape removes scripts, forms, frames, embedded media, external styles, tracking-capable resources, and unsafe URL schemes. Snapshots are displayed in a sandboxed extension page with network loading disabled. Snapshots inside protected collections are encrypted with the Vault data.

## Retention and User Control

- Deleted items remain in Trash until restored or permanently deleted.
- Linkscape keeps up to five rolling recovery points locally.
- Users can remove optional saved-site permissions from Settings.
- Users can export their data as JSON, CSV, or bookmark HTML.
- Users can permanently delete data, reset protected Vault data, clear extension storage, or uninstall Linkscape.

Exported files are controlled by the user after download. A JSON backup can contain encrypted Vault payloads and password-verification metadata and should be treated as sensitive.

## Children

Linkscape is a general productivity tool and is not directed to children under 13.

## Changes and Contact

Material policy changes will be published at the same public URL with an updated effective date. Privacy and security questions can be reported through the contact process in `SECURITY.md` in the official Linkscape repository: https://github.com/shivenpatro/Linkscape-Extension
