# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person running their own MeTube instance on a home server, using it from a desktop browser and from a phone about equally. On the desktop they paste a link, glance at progress now and then, and grab the finished file. On the phone they share a link into the installed PWA (share target) and check status. The same person also administers the instance.

## Product Purpose

A self-hosted web UI for yt-dlp: give it a URL, it runs yt-dlp well, and correct files appear on the server. Success is a download that finishes with the right file in the right place without the user babysitting it, and a history they can scan to find, fetch, retry, or clear what they downloaded.

## Positioning

It is a thin, trustworthy front end to yt-dlp on your own machine: no accounts, no third-party metadata services, no network egress beyond what yt-dlp itself does. It improves the write at download time and deliberately stops there; organising or retagging files afterwards belongs to dedicated tools (beets, Picard, Lidarr).

## Operating Context

- Adding: a URL bar with Download and Subscribe, a row of per-download choices (type; codec, format, quality; audio tags; caption language and source), and advanced options (folder, name prefix, SponsorBlock, chapter splitting, clip range, auto start, item limit, option presets, password, custom yt-dlp options, cookies, bulk import/export).
- Watching: the Downloading list (downloading with speed and ETA, post-processing, queued for a slot, pending with auto-start off, waiting for a scheduled live stream).
- Collecting: the Completed list, which can hold thousands of entries (finished, failed with error details, chapter files), with per-row download, share, retry, open-source and delete actions and bulk selection.
- Subscriptions to channels and playlists that are checked on an interval and queue new uploads.
- Settings: server-stored defaults for the add form, shared by every browser.
- Deployed in Docker, optionally under a URL_PREFIX subpath or behind a reverse proxy; installable as a PWA.

## Capabilities and Constraints

- Download types: video, audio, captions, thumbnail; single videos, playlists and channels.
- Real-time status arrives over Socket.IO, twice a second per active download; the UI must stay responsive with a history of thousands of rows.
- Frontend: Angular 22 standalone components, Spartan UI (helm) on Tailwind v4. Backend: Python aiohttp + yt-dlp.
- Scope line (from AGENTS.md): no post-download tag editing, no external metadata lookups, no library reorganisation.
- Every non-markdown push to master releases; changes must be release-ready as merged.

## Brand Commitments

- The name "MeTube" and its red logo mark (`ui/src/assets/icons/`) stay as they are.
- Built on Spartan UI components: they may be restyled, not replaced by another library.
- Light, dark and auto (follow the OS) themes are all first-class.
- The download and history lists stay dense and scannable tables, never one card per download.

## Evidence on Hand

- Logo and icon set: `ui/src/assets/icons/` (PNG sizes, favicon, Safari pinned-tab SVG).
- README screenshot of the previous UI: `screenshot.gif` in the repository.
- No testimonials, usage statistics or third-party endorsements exist; do not invent them.

## Product Principles

1. The URL bar is the product: adding a download is the one action that must always be immediate.
2. State must be legible at a glance: what is running, what is waiting and why, what failed and how to recover.
3. Density over decoration: a long history is the normal case, and it must stay fast to render and fast to scan.
4. The server does the work; the UI never implies capabilities yt-dlp does not provide.
5. One person, many devices: every screen works as well on a phone as at a desk.
