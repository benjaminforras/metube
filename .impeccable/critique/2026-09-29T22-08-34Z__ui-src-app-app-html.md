---
target: the add-URL bar (input, Download, Subscribe)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:D:\\Documents\\Projects\\Personal\\metube\\ui\\src\\app\\app.html"
target_fingerprint: "sha256:708dc295d699c1e8f21834dd9f0bc054ed35136bffa65fb3db4566cc0f6d61c0"
target_path: "D:\\Documents\\Projects\\Personal\\metube\\ui\\src\\app\\app.html"
timestamp: 2026-09-29T22-08-34Z
slug: ui-src-app-app-html
---
Method: dual-agent (A: a83b6d01f965fc6fa · B: a29a70640e10b02a2)

# Critique: the add-URL bar (URL input, Download, Subscribe)

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | "Adding…" at disabled opacity (~3.4:1 light), the row shifts, focus drops to body, no aria-busy; success loop is good |
| 2 | Match System / Real World | 2 | Raw backend/yt-dlp strings ("400: missing 'url'…", "ERROR: [generic] …") |
| 3 | User Control and Freedom | 3 | Cancel works, URL survives an error; input locked for the whole request |
| 4 | Consistency and Standards | 2 | 14px input vs 16px buttons; Download has no hover, Subscribe does; empty-field check only for Subscribe |
| 5 | Error Prevention | 1 | No check before Download's network call; type=text; recurring Subscribe is a one-tap peer with hidden settings |
| 6 | Recognition Rather Than Recall | 3 | Selects show values; Subscribe's settings invisible at commit |
| 7 | Flexibility and Efficiency | 2 | Enter submits; no autofocus, no URL keyboard, can't queue the next link during extraction |
| 8 | Aesthetic and Minimalist Design | 3 | Quiet; Reset/Edit defaults add a third control row |
| 9 | Error Recovery | 2 | Toast about 700px from the field, not marked invalid, focus lost |
| 10 | Help and Documentation | 2 | Nothing explains Subscribe |
| Total | | 22/40 | Acceptable |

## Design Specificity Verdict
Stock shadcn input group; interchangeable. Primary action is plain monochrome; the red brand mark is absent from the one action that matters. In dark mode Subscribe reads heavier than Download, and the white Downloading pill outshines both.
Detector: CLI exit 0, 0 findings. Browser: 2 × low-contrast (4.3:1) on .list-pill-count in light (not the bar). Measured: focus ring 1.56:1 light / 1.88:1 dark, input's right ring edge hidden at the join; input/Subscribe borders 1.26:1 light / 1.69:1 dark; mobile input 31px tall.

## What's Working
1. type=submit with a clean success loop (app.html:121, app.ts:1297).
2. Cancel while adding; URL kept on error.
3. aria-label, labelled button group, 16px on phones, Advanced collapsed.

## Priority Issues
- [P1] Download and Subscribe look like equals (joined control, a 50/50 split on phones, dark-mode inversion, settings hidden). Fix: join only Download; Subscribe becomes a secondary control or a split-button option; confirm what was committed. Command: /impeccable layout
- [P1] Busy state locks the bar and highlights a red Cancel; row jumps; focus lost; no aria-busy (app.html:94-111). Fix: fixed group width, aria-disabled full-contrast label, neutral Cancel, aria-busy, refocus, ideally accept the next link. Command: /impeccable harden
- [P1] Mobile input is 31px: flex-1 (basis 0%) in the flex-col wrapper overrides h-11 (app.html:85-89). Fix: md:flex-1; inputmode=url, enterkeyhint=go. Command: /impeccable adapt
- [P2] Errors in backend wording, shown only as a distant toast; no empty-field check in addDownload (app.ts:1274 vs 652). Fix: browser-side check, inline aria-invalid message, strip the yt-dlp prefix, refocus and select. Command: /impeccable clarify
- [P2] Focus ring 1.56:1 and hidden at the join; borders 1.26:1; input 14px (md:text-sm beats text-base); no hover on Download (hlm-button.ts:13). Command: /impeccable polish

## Persona Red Flags
Alex: no autofocus; locked field; focus lost after an error; row width jumps.
Casey: 31px field; Cancel appears where Subscribe was; bar far from the thumb; no URL keyboard; the share target posts hardcoded quality/format (custom-service-worker.js:25-26).
Sam: 1.56:1 hidden-edge ring; focus to body on submit; disabled "Adding…" can't be focused; nested live regions in toasts.

## Minor Observations
Pill count badge contrast 4.3:1; the bar (x=160, 960px) doesn't align with the lists (x=82); 64px top margin on phones; Reset vs Edit defaults needs a mental model; amber Canceling state; placeholder could be "Paste a link…".

## Questions to Consider
Should the URL bar ever be disabled? Should Subscribe be offered after extraction reports a channel or playlist? Where is MeTube's red? Should the share target open the bar pre-filled?
