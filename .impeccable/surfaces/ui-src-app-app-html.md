---
version: 1
slug: "ui-src-app-app-html"
primary_target: "ui/src/app/app.html"
related_targets: ["ui/src/app/components/settings-page.component.html"]
---

# Surface brief: the MeTube app (downloads page, Settings)

Scope: the whole web app (navbar, add form, Downloading, Completed, Subscriptions, Settings, toasts, tooltips). Visitor mode: Operate.

Audience and task: one self-hoster on desktop and phone. Paste a link and download; glance at what is running, waiting or failed; fetch, retry or clear finished files; manage subscriptions and form defaults.

Constraints: Spartan components restyled, not replaced; light, dark and auto first-class; dense tables, never a card per download; MeTube name and red logo kept; first render of a 2,000-row history stays near 1.3 s and progress ticks stay per-row.

## Direction contract

THESIS: MeTube is a darkroom contact sheet. Every download is a frame on one film strip running down the page; the queue develops, the history is the proof sheet you mark up. It refuses the neutral admin dashboard of rounded cards and a blue accent.

OWN-WORLD: proof-paper ground (cool white; darkroom near-black in dark), film-base black rebates with sprocket holes, amber edge printing (mono caps, tabular) for live data, labels and counts, red china-marker for proofing marks and failures. One exposure legend everywhere: grey hatch = queued, amber = downloading, ink = done, red = failed. Square-ish corners, hairlines, system sans for titles.

STORY: the user sees at a glance what is exposing, what waits, what failed; adds a link in one move; marks frames to act on them.

FIRST VIEWPORT: a black film-edge navbar with the logo and the live counts as amber edge print; below, the URL bar framed by easel corner marks as the one bright exposure, Download in ink; the option row with edge-print labels; then the Downloading section as a black rebate band ("DOWNLOADING 07") and its rows as frames along a vertical film strip with frame numbers.

FORM: Contact Sheet, candidate 7 of 7, seed key ccd4251e. Raises: stable frame numbers (Saville); state lives in the strip, failures are light-struck red leaks (depot blind); collapsed sections fold to a packet strip that still reports counts and live progress (Miura); one exposure legend held level everywhere (gravity rain).

SIGNATURE INTERACTION: marking a frame. Selecting a row draws a red china-marker ring around its frame number, stroked on in about 220 ms; reduced motion shows it instantly.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
