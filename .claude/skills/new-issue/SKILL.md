---
name: new-issue
description: Draft and open a GitHub issue in this repo, sized to one implementation session, with the right labels, dependency edges and epic parent. Use when the user wants to file an issue, says "open an issue for this", "file a ticket", "/new-issue", or describes work that should be tracked rather than done now. Also use to fix the metadata on an issue that already exists.
---

Open one issue, labelled and wired into the graph. Do not implement the work.

## 1. Size it before drafting

One issue is one agent session: roughly 150k tokens of context covering the code it has to read, the change, the tests, and the runs that go red before they go green. If the work does not fit in that, it is not an issue yet.

Nobody can count tokens while drafting, so use the proxies:

- More than two packages changed, or a change that has to land in `engine`, `protocol`, `server` and `web` to be usable at all.
- A `## Scope` checklist whose items are not facets of one mechanism. Five boxes describing one change is fine. Three boxes describing three changes is three issues.
- A migration, a new UI surface and a new wire message in the same body.
- Any item that would need its own design decision before it can start.

When it does not fit, split. Either a plain sequence of issues wired `blocked_by`, or an `epic` with sub-issues when the pieces only make sense under one umbrella. `#77` is the split done right: `protocol` and `server` in one issue, `web` in another. The epic body carries the shared reasoning and the rejected alternatives once; the children carry the work and stay boring.

Split along seams that ship, not along layers for their own sake. Principle 3, every stage independently deployable, applies to issues too: each child should leave the app working.

## 2. Draft the body before touching `gh`

House style, from the existing issues. Match it.

- Open with the problem as it stands in the code, not the feature as a wish. `#17` opens "Every move repaints instantly", `#3` opens "Rooms accumulate and nothing reclaims them".
- Cite `path/file.ts:line` for every claim about current behaviour. Verify each one by reading the file. A stale line number is worse than no line number.
- `## Why` carries the cost of not doing it. `## What` carries the shape of the change. `## Scope` is a checklist when the work splits cleanly.
- Say what you considered and rejected, and why. `#73` explains why pieces do not come first. `#24` names the `json_extract` versus denormalized-column fork instead of picking silently. That reasoning is the part that rots if it stays in a chat.
- Name open questions as open. Do not resolve them by omission.

No emoji. No closing summary.

## 3. Pick labels

Two independent axes. Apply both.

**Kind — exactly one:**

| label | when |
| --- | --- |
| `feature` | user-visible capability |
| `bug` | something is broken or leaks |
| `chore` | CI, tests, tooling, refactor, no user-visible change |
| `epic` | umbrella over issues that will be its sub-issues |

Test for `feature` versus `chore`: could a player notice? A test harness (`#92`) and an auth refactor (`#65`) are `chore` even though both are substantial.

**Package — every one the change touches, none it does not:**

`engine` `server` `protocol` `web` `infra`

Read the dependency direction before guessing: engine → protocol → server / web. A new piece type is `engine` alone until something has to carry it, and then `#77` shows the pattern — `protocol` and `server` in one issue, `web` split into its own.

**`parked`** is separate from kind and stacks with it. It means nothing blocks this and it still is not scheduled — `#19` is postponed, `#50` is an umbrella with no queue. Never use it for work waiting on another issue; that is a dependency.

## 4. Wire the graph

The labels are the cheap half. These edges are what the label set deliberately does not carry.

**Blocked by.** If the body says "depends on #N" or "do not start until #N", record it. Prose alone is how `#51`, `#32` and `#31` ended up claiming blockers that had already closed.

```bash
gh api -X POST repos/:owner/:repo/issues/<N>/dependencies/blocked_by \
  -F issue_id="$(gh api repos/:owner/:repo/issues/<BLOCKER> --jq .id)"
```

`-F` not `-f`. The field is an integer node id, not the issue number, and `-f` sends it as a string and fails 422.

There is no `is:blocked` search qualifier. It parses and silently matches nothing. The ready queue is:

```bash
gh issue list --state open --limit 100 --json number,title,blockedBy \
  --jq '[.[] | select([.blockedBy.nodes[] | select(.state=="OPEN")] | length == 0)] | .[] | "#\(.number) \(.title)"'
```

**Parent.** If it belongs to an open epic, make it a sub-issue rather than mentioning the epic in prose.

```bash
gh api -X POST repos/:owner/:repo/issues/<EPIC>/sub_issues \
  -F sub_issue_id="$(gh api repos/:owner/:repo/issues/<N> --jq .id)"
```

## 5. Confirm, then open

Show the user the title, the body and the labels. Opening an issue is outward-facing; do not create it unasked.

```bash
gh issue create --title "..." --body-file <path> --label <kind> --label <pkg> [--label <pkg>]
```

Story numbers (`S-6.4`) go in the title only when the issue is one step of a numbered phase already in flight. Standalone issues do not get one.

Then add the edges from step 4 and print the issue URL.
