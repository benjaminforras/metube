---
target: the add-URL bar (switch, field, button, Subscribe mode)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:D:\\Documents\\Projects\\Personal\\metube\\ui\\src\\app\\app.html"
target_fingerprint: "sha256:7a954d6eb9d69d94e3df6c2065300c1a6a942972781c5710f254414f5ae44807"
target_path: "D:\\Documents\\Projects\\Personal\\metube\\ui\\src\\app\\app.html"
timestamp: 2026-09-29T23-05-22Z
slug: ui-src-app-app-html
---
Method: dual-agent (A: a0c9cf25e9c4f72df · B: a81418037a35efc0c)

# Critique: the add-URL bar (third run)

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Active pill can be off-screen on phones |
| 2 | Match System / Real World | 3 | Plain copy |
| 3 | User Control and Freedom | 2 | Subscription can't be cancelled and locks the bar |
| 4 | Consistency and Standards | 3 | Clicking a switch's label text opens a help popover |
| 5 | Error Prevention | 3 | Title filter checked before sending; mode resets |
| 6 | Recognition Rather Than Recall | 3 | Mode always visible |
| 7 | Flexibility and Efficiency | 2 | No autofocus or paste-anywhere; can't submit during an add |
| 8 | Aesthetic and Minimalist Design | 3 | Four selects always at full weight |
| 9 | Error Recovery | 3 | Strong error flow; title-filter error lacks the reason |
| 10 | Help and Documentation | 3 | Tooltips and help popovers |
| Total | | 28/40 | Good |

## Design Specificity Verdict
Stock Spartan by intent; about 85% finished; the gaps are behaviour. Detector: CLI 0 findings (no inline styles to scan); browser clean in 4 views. Measured: switch selected segment vs track 1.09 light / 1.31 dark; switch options 36px tall on phones; field ring colour lost against the button (1.05:1), but the 2px gap now outlines that edge.

## Priority Issues
- [P1] A subscription request locks the whole bar (app.ts:1323, app.html:89). Release the bar on send; show pending state under Subscriptions. /impeccable harden
- [P1] No desktop autofocus and no paste-anywhere. /impeccable adapt
- [P2] Switch selection barely visible (1.09/1.31); options 36px on phones. /impeccable polish
- [P2] Clicking the skip-members-only label text opens help instead of toggling (app.html:204-208); help buttons add tab stops. /impeccable harden
- [P2] Active pill scrolled out of view on phones; no scroll cue. /impeccable adapt

## Persona Red Flags
Alex: Enter ignored during adds; subscription lock; no paste-anywhere; field narrows when the × appears. Casey: share target bypasses the bar with hardcoded quality/format; list starts around y=590; pill off-screen. Sam: field label not mode-aware; help Tab stops; silent Enter while busy; settings after the button in reading order.

## Minor Observations
Stale comment app.ts:135; app.ts:1416 bypasses clearAddError(); timer copy; Subscribe settings ungrouped, editable mid-request, 28px shift; "Subscribe to a channel" omits playlists; title-filter error lacks the reason.

## Questions to Consider
Choose Subscribe before pasting, or offer it after a channel resolves? Should any request own the bar? Collapse the selects on phones?
