# Risk signal contract

This document describes the deterministic rules currently implemented by the live risk engine and the health trend endpoint. Thresholds are heuristic defaults that need validation with real teams; they are not calibrated probabilities of missing a deadline. Evidence explains the rule that fired, while the suggested action is a prompt for team review rather than an automated decision.

The live dashboard returns the five highest-ranked current risks. It sorts by severity (HIGH, MEDIUM, LOW), then by a signal-specific impact value, then by type name. Health score uses all live risks, not just the five shown: HIGH deducts 15 points and MEDIUM deducts 7. Task-linked deductions share a per-task cap of 25; risks without a task are deducted globally. Scores bottom out at 0. Status is HEALTHY at 90+, ON_TRACK at 70–89, AT_RISK at 50–69, and CRITICAL below 50.

## Current-state risks

| Signal | Trigger and severity | Evidence shown | Suggested response |
| --- | --- | --- | --- |
| TASK_OVERDUE | An unfinished task has a due date earlier than analysis time. Always HIGH. | Days overdue. | Agree a recovery date with the assignee, or re-plan scope and deadline. Open the task. |
| TASK_STAGNANT | An unfinished task has lastActivityAt at least 5 whole days old. HIGH only for critical priority; otherwise MEDIUM. Tasks without lastActivityAt are not flagged. | Inactive days. | Check in with the assignee; unblock, reassign, or split the work. Open the task. |
| TASK_BLOCKED | Task status is blocked. HIGH for high or critical priority; otherwise MEDIUM. | Current blocked status. | Identify the blocker and assign someone to resolve or escalate it. Open the task. |
| DEPENDENCY_BOTTLENECK | An unfinished task has at least 3 direct outgoing dependency edges to unfinished tasks. Always HIGH. | Count of directly dependent unfinished tasks. | Review the blocking task and dependent work; split or resequence if possible. Open the task. |
| MILESTONE_RISK | An unfinished milestone with a due date no more than 7 floored days away (including overdue) has at least one unfinished linked task. Always HIGH. | Unfinished task count and days until/after deadline. | Review unfinished tasks and owners, then agree a recovery plan or revised date. Open the milestone section. |
| WORKLOAD_IMBALANCE | At least 2 contributors have active assigned work. A contributor is flagged at 3 or more tasks and at least twice the median workload. MEDIUM. | Contributor active task count and contributor median. | Review assignments and move or defer lower-priority work. Open the task list filtered to that contributor. |
| GITHUB_AGING_PR | A PR reconstructed as open from GitHub opened/closed/merged events is at least 7 whole days old. MEDIUM at 7–13 days; HIGH at 14+. | PR age in days, number/title when available. | Ask author and reviewers to agree on the next review step or split the PR. Link directly to the PR when repository context is available. |
| GITHUB_ISSUE_BACKLOG | In the trailing 14 days, at least 3 issue-open events occurred and opened minus closed events is at least 3. MEDIUM. | Opened, closed, and net event-count growth. | Triage new issues, close duplicates, and assign owners and priorities. Link to repository issues. |
| GITHUB_LOW_MERGE_THROUGHPUT | In the trailing 14 days, at least 3 PR-open events and zero PR-merged events occurred. MEDIUM. | PR opens and zero merges in the window. | Review open PRs for missing reviewers, failing checks, or oversized changes. Link to repository PRs. |
| GITHUB_HIGH_PR_CYCLE_TIME | At least 3 PRs have both opened and merged events; median open-to-merge time is at least 72 hours. MEDIUM at 72–167.9 hours; HIGH at 168+. | Number of merged PRs analyzed and median cycle time in hours. | Inspect recent PRs for review delays, large changes, or release bottlenecks. Link to repository PRs. |

GitHub issue counts are event counts, not a synchronized count of currently open issues. PR state and cycle time depend on retained webhook signals; missing historical events can omit or distort an item's state. These signals should be read alongside GitHub, especially after reconnecting a repository or restoring data.

## Snapshot trend signals

The health trend endpoint compares the oldest and newest snapshots returned for the requested range (default 30 snapshots). Signals need at least two snapshots, except velocity signals, which need at least seven. Because snapshots are scheduled daily, the selected range is generally days but is technically a snapshot count.

| Signal | Trigger and severity | Evidence shown | Suggested response |
| --- | --- | --- | --- |
| HEALTH_DECLINING | Health score falls by at least 10 points between endpoint snapshots. MEDIUM at 10–19 points; HIGH at 20+. | Previous score, current score, signed score change. | Review highest-severity current risks and assign an owner and due date to each response. |
| BLOCKED_WORK_INCREASING | Blocked task count increases by at least 2. MEDIUM at +2/+3; HIGH at +4+. | Previous count, current count, increase. | Review blocked tasks and resolve the most common blocker first. |
| OVERDUE_WORK_INCREASING | Overdue task count increases by at least 2. MEDIUM at +2/+3; HIGH at +4+. | Previous count, current count, increase. | Reconfirm owners and dates; adjust scope when the plan is no longer realistic. |
| BLOCKED_WORK_RATIO_INCREASING | Blocked tasks divided by unfinished tasks increases by at least 10 percentage points. MEDIUM at +10 to <20 pp; HIGH at +20 pp. A zero unfinished-task denominator yields a zero ratio. | Previous and current ratios and percentage-point change. | Remove blockers from unfinished work before adding commitments. |
| OVERDUE_WORK_RATIO_INCREASING | Overdue tasks divided by unfinished tasks increases by at least 10 percentage points. Same severity bands as blocked ratio. | Previous and current ratios and percentage-point change. | Re-plan overdue work and communicate a credible delivery date. |
| COMPLETION_VELOCITY_DECLINING | With at least 7 snapshots, compare average nonnegative per-snapshot completion changes in the first and second halves. Requires a positive earlier average and at least a 50% decline. MEDIUM at 50–<75%; HIGH at 75%+. | Earlier/recent average progress per snapshot and decline ratio. | Check aging in-progress tasks and capacity; reduce work in progress if needed. |
| MILESTONE_PROGRESS_SLOWING | Same velocity calculation using completed tasks linked to milestones. MEDIUM at 50–<75%; HIGH at 75%+. | Earlier/recent average milestone-task progress per snapshot and decline ratio. | Review unfinished milestone tasks with owners and revise the delivery plan. |
| RISK_EXPOSURE_INCREASING | Combined HIGH+MEDIUM risk count increases by at least 2 between endpoint snapshots. MEDIUM at +2/+3; HIGH at +4+. | Previous count, current count, increase. | Prioritize newly elevated risks and assign mitigation owners. |
| RISK_PERSISTENCE_INCREASING | An active risk history record has appeared in at least 3 detections. MEDIUM when any qualify; HIGH when any one record has at least 5 detections. | Number of persistent risks, high-persistence count, identity/type/severity, detection count, first and last detection times. | Revisit repeated risks and change the mitigation plan or remove the blocker. |

Velocity is measured per adjacent snapshot, not per calendar day; gaps in snapshot dates are not normalized. Trend rules compare endpoints and can miss intermediate rises and falls. Persistence detections count analysis runs, not necessarily days.

## Dashboard and acceptance examples

Every live risk card displays its message and evidence, and now includes the relevant task, milestone, contributor, or PR context when that entity is available, plus a recommended next step. Internal links open the task, milestone section, or contributor-filtered task list. GitHub links are shown only when a repository name passes validation; the recommendation remains visible without a link.

Trend cards display the comparison evidence, severity, recommended response, and a link to current execution risks. A trend can remain actionable even when its cause has cleared, so the link is a starting point for review rather than a claim that the same risk is still active.

Representative expected outcomes:

1. An unfinished task 3 days overdue produces one HIGH TASK_OVERDUE signal with 3 days of evidence and an open-task action.
2. A critical task last active 6 whole days ago produces HIGH TASK_STAGNANT; a normal-priority task at the same age produces MEDIUM.
3. A task with 2 direct unfinished dependents does not trigger DEPENDENCY_BOTTLENECK; with 3 it triggers HIGH. A transitive chain is not counted as a direct dependent.
4. A milestone due within 7 floored days with unfinished linked work produces HIGH MILESTONE_RISK; no unfinished linked work produces no risk.
5. One contributor with 6 active tasks and another with 2 yields median 4 and does not trigger workload imbalance; with a third contributor at 1, median is 2 and the 6-task contributor is flagged.
6. A PR at 6 whole days is not aging; at 7 days it is MEDIUM; at 14 it is HIGH, provided its event history still resolves to open.
7. Three issues opened and none closed in 14 days produces MEDIUM backlog risk. Three opened and one closed does not, because net event-count growth is 2.
8. Three PR opens and no merges in 14 days produces MEDIUM low-throughput risk; any merge suppresses that signal for the window.
9. Three completed PR cycle times with a 72-hour median produce MEDIUM cycle-time risk; a 168-hour median produces HIGH.
10. Health snapshots from 84 to 63 decline by 21 points and produce HIGH health decline; from 84 to 64 is exactly 20 points and also produces HIGH. A 10–19 point decline produces MEDIUM.
11. An unfinished-work blocked ratio rising from 10% to 20% produces MEDIUM with a 10 percentage-point increase (subject to the stored integer counts).
12. Seven snapshots are required for velocity: if the earlier mean progress is 2 tasks per snapshot and recent mean is 0.8, the 60% decline is MEDIUM.
13. An active risk seen three times produces MEDIUM persistence; one seen five times makes the signal HIGH.

Threshold changes should be made with tests and updated examples here. The dashboard cards support review and follow-up; they do not assign owners or alter plans automatically.
