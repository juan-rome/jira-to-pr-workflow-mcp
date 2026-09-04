# Real runs

A log of actual runs against a live Jira/GitHub MCP connection — not a
synthetic example. Newest first.

---

## 2026-09-03 — KAN-4 (first real run: MCP fetch, gate, dedupe, and close-the-loop all confirmed)

Run from inside a local clone of
[jira-pr-demo-target](https://github.com/juan-rome/jira-pr-demo-target),
with both `atlassian` and `github` MCP servers connected (`--scope user`)
and authenticated — Jira via OAuth, GitHub via a fine-grained PAT in a
header (see **What this run found**, first item).

**Ticket:** [KAN-4](https://juan-rome.atlassian.net/browse/KAN-4) — the
same ticket [jira-to-pr-workflow](https://github.com/juan-rome/jira-to-pr-workflow)'s
own `RUNS.md` already fully implemented and shipped as
[jira-pr-demo-target#1](https://github.com/juan-rome/jira-pr-demo-target/pull/1).
It was reused deliberately for a first test — low-stakes, and a strong
test of whether this version's dedupe logic (Step 5) correctly recognizes
already-done work instead of blindly duplicating it.

### What happened, step by step

- **Step 0:** both MCP connections validated before touching anything —
  Atlassian confirmed connected, then GitHub confirmed connected.
- **Step 1:** fetched KAN-4 via the Atlassian MCP server's Jira tool.
- **Step 2:** the imported `assessTicketQuality` returned
  `sufficient: true` on the normalized ticket.
- **Steps 3-4:** checked the repo directly rather than re-implementing —
  the `kan-4-character-counter` branch already had the live counter,
  the red-at-480 threshold, the `maxlength=500` hard stop, and passing
  tests (5/5) matching KAN-4's acceptance criteria and testing plan
  exactly.
- **Step 5:** searched for an existing PR via the GitHub MCP server
  before creating one — found
  [PR #1](https://github.com/juan-rome/jira-pr-demo-target/pull/1)
  already open with the correct body and screenshot, and correctly did
  **not** open a duplicate.
- **Step 6 (confirmed with the user first):** attached
  `kan-4-near-limit.png` to KAN-4 as attachment `#10001`, and posted a
  comment linking to PR #1 — both via the Atlassian MCP server.

### What this run found (and what got fixed because of it)

1. **GitHub's MCP endpoint doesn't support OAuth's dynamic client
   registration.** `/mcp` failed with "Incompatible auth server." Fixed
   by using a fine-grained PAT (Pull requests: Read and write only,
   scoped to `jira-pr-demo-target`) passed via `--header` instead —
   `SKILL.md`'s Setup section now documents this as the real path, not
   OAuth.
2. **A real module-resolution bug in Step 1.** Calling
   `normalize-ticket.mjs` from a throwaway script outside this repo's own
   directory failed — Node only walks up from the *running script's own
   location* to find `node_modules`, so it couldn't resolve the
   `jira-to-pr-workflow` git dependency. Fixed by adding
   `scripts/normalize-ticket-cli.mjs`, a proper CLI wrapper meant to be
   invoked by its absolute path; `scripts/test-normalize-cli.mjs`
   regression-tests this exact scenario by running the CLI from an
   unrelated `cwd` on purpose.
3. **Step 6 is real and it works.** The Atlassian MCP server exposes a
   two-phase `uploadAttachmentToJiraIssue` tool (one call to get an
   upload target, a second to complete the attachment), and its comment
   tool posts fine. This was the single biggest open question at build
   time and it's resolved.

### What's still open

- **The exact Jira `description` response shape** (raw ADF vs.
  already-flattened text) wasn't logged during this run —
  `normalize-ticket.mjs` handled it correctly either way, so the gate and
  the PR body were both right, but which code path actually fired is
  still unconfirmed. Worth checking explicitly next time.
- **A real Jira @-mention** (not just a plain PR-link comment) hasn't
  been tested — this run only posted an unmentioned comment.
- This run didn't exercise Steps 3-4's actual "write new code" path,
  since KAN-4 was already fully implemented from v1's run. The dedupe
  logic is now proven; a genuinely fresh ticket would be the next useful
  test for the implementation path itself.
