---
target: the add-URL bar (field, split button, Subscribe mode)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:D:\\Documents\\Projects\\Personal\\metube\\ui\\src\\app\\app.html"
target_fingerprint: "sha256:b0d9cd44e06790571af5d11a056d1bd158a9aae99cdae2ac1f6e523b6b497e2a"
target_path: "D:\\Documents\\Projects\\Personal\\metube\\ui\\src\\app\\app.html"
timestamp: 2026-09-29T22-31-31Z
slug: ui-src-app-app-html
---
Method: dual-agent (A: a5cb20d38c01b49ed · B: a4de6ce56aa9fea44)

# Critique: the add-URL bar (second run)

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | "Connecting to server…" shown far from the greyed-out bar (app.html:773) |
| 2 | Match System / Real World | 3 | yt-dlp wording still visible |
| 3 | User Control and Freedom | 3 | Subscribing can't be cancelled (app.html:121,133) |
| 4 | Consistency and Standards | 3 | "link"/"URL" drift; empty-state copy ignores the mode |
| 5 | Error Prevention | 2 | Placeholder not mode-aware; Enter during an add silently ignored |
| 6 | Recognition Rather Than Recall | 2 | Subscribe only behind an unlabelled chevron; empty state says "choose Subscribe" |
| 7 | Flexibility and Efficiency | 2 | No autofocus or shortcut; mode resets after each subscription |
| 8 | Aesthetic and Minimalist Design | 3 | Subscribe settings ungrouped |
| 9 | Error Recovery | 3 | Regex error marks the wrong field |
| 10 | Help and Documentation | 3 | Menu descriptions and help tooltips |
| Total | | 27/40 | Acceptable (was 22) |

## Design Specificity Verdict
Deliberately generic and mostly finished, per the "neutral, but finished" intent. The active black pill competes with the Download button. Detector: CLI 0 findings; browser clean in 5 views (light, dark, mobile, menu open, Subscribe mode). Measured: field border 3.69/3.66, focus ring vs page 3.19/3.77, placeholder 4.74/7.07, error 4.77/6.85; mobile controls 44px. Ring edge at the joins with neighbouring controls 1.05:1 light / 1.12:1 dark.

## Priority Issues
- [P1] Subscribe hard to find; weak sign of the mode (only the chevron; placeholder and empty states not mode-aware; app.html:95, 841, 1087). /impeccable clarify
- [P2] Focus ring edge vanishes against the neighbour's fill (1.05:1 / 1.12:1). Fix: ring-offset-2 ring-offset-background. /impeccable polish
- [P2] Title-filter regex error routed to the URL field (app.ts:682). /impeccable harden
- [P2] Rejected link shows an inline error plus an unexplained Failed row; recording the row is deliberate (app/ytdl.py:2047), so acknowledge it in the message. /impeccable clarify
- [P2] No cancel while subscribing; disconnected explanation far from the bar. /impeccable harden

## Persona Red Flags
Alex: Enter ignored while an add runs; no shortcut; mode resets; batch import buried. Casey: share target bypasses the bar with hardcoded quality/format; bar out of thumb reach; Subscribe mode pushes options down about 130px. Sam: run-on menu item names; mode change not announced; silent cancel; regex error on the wrong field.

## Minor Observations
Wording drift; no full stops or suggested fixes in errors; error line shifts layout about 28px; "Canceling…" invisible; "Advanced Options" styled like a heading; redundant group aria-label.

## Questions to Consider
Subscribe one tap away? Are the format options part of a subscription? Share target with defaults and a confirmation?
