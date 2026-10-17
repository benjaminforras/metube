---
target: changed parts of the download row (pending state, progress label centering)
total_score: 20
max_score: 32
na_heuristics: 9,10
p0_count: 0
p1_count: 2
target_identity: "file:D:\\Documents\\Projects\\Personal\\metube\\ui\\src\\app\\components\\download-row.component.ts"
target_fingerprint: "sha256:a97e84380f1d5395c8eaadabbdbe89ba2fcf762d5b6b05bddef854b085aa947f"
target_path: "D:\\Documents\\Projects\\Personal\\metube\\ui\\src\\app\\components\\download-row.component.ts"
timestamp: 2026-09-30T00-02-08Z
slug: ui-src-app-components-download-row-component-ts
---
# Critique: Downloading row: pending state and progress label centering
Method: dual-agent (A: a496aadcdddc7e94c, B: ab7c14e0809cb01a1). Target: ui/src/app/components/download-row.component.ts (commit e70f48c).

## Design Health Score (20/32, Acceptable; 9 and 10 n/a)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Pending is accurate now; Queued still shows the same animated bar as Preparing |
| 2 | Match System / Real World | 2 | Pause icon implies pause/resume, which MeTube lacks |
| 3 | User Control and Freedom | 3 | Start is off-screen at 390px |
| 4 | Consistency and Standards | 2 | Three waiting states use three different looks |
| 5 | Error Prevention | 3 | A never-started download no longer looks stalled |
| 6 | Recognition Rather Than Recall | 2 | "Not started" gives no reason (auto-start off) |
| 7 | Flexibility and Efficiency | 3 | Bulk start unchanged |
| 8 | Aesthetic and Minimalist | 3 | Quiet, exactly bar-sized; outline barely visible |
| 9 | Error Recovery | n/a | no error states in scope |
| 10 | Help and Documentation | n/a | row-level scope |

## Design Specificity
Stock Spartan styling; the darkroom direction in the surface brief is not shipped. The dashed slot is the natural seed for "grey hatch = queued". Component scan clean ([]). Browser detector: 7 findings, all outside the changed code and false positives (navbar text-info icons x6, indeterminate-bar marquee x1, detector's own overlay dark-glow).

## Key correction
Pending did not show an empty bar: percent:null made Spartan show the indeterminate animated sweep. Queued rows still do. The comment added in the change is inaccurate.

## Priority Issues
- [P1] Queued shows the same animated bar as Preparing/Post-processing. Fix: shared dashed waiting slot with the reason as text ("Waiting for a slot"); drop the badge by the title; at minimum pass 0 not null for queued.
- [P1] Pause icon implies pause/resume; "Not started" gives no reason. Fix: copy "Auto-start off"; use the Start button's icon or none.
- [P2] Dashed border is 1.26:1 in both themes (border-border). Fix: border-muted-foreground/40 (~2.4:1). Text: 4.74:1 light, 7.66:1 dark.
- [P2] On a phone the Start button is off-screen (542px table in a 366px scroller). Fix: make the pending slot the Start button (button, aria-label "Start download for {title}").
- [P3] Scheduled badge not in the bar slot (x=269 vs 518, 243x22). Fix: ms-auto plus a width cap, or move it into the shared slot.

## Persona Red Flags
- Alex: can't tell Queued from Preparing at a glance; no queue position; pause icon implies a pause feature.
- Sam: Queued announced as an indeterminate progress bar ("busy"); progress bars have no accessible name; the downloading row reads "42% 42%".
- Casey: Start off-screen; short titles centered while long ones left-align; Queued rows taller.

## Minor Observations
- Fix the inaccurate code comment.
- Dark: white "42%" on the green fill is about 2.3:1 (predates the change).
- With reduced motion on, Queued rows still pulse.

## Questions
- Should the empty slot be the Start button?
- One hatch pattern at three densities for the three kinds of waiting?
- A toolbar line ("3 waiting for Start · Start all") instead of each row explaining itself?
