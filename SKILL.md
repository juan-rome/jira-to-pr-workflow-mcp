---
name: jira-to-pr-mcp
description: MCP-native version of jira-to-pr-workflow. Fetch a Jira ticket via the connected Atlassian MCP server, verify it has a real description, acceptance criteria, and a testing plan before touching any code, implement the change, open a pull request via the connected GitHub MCP server, attach a real screenshot, and optionally comment/mention back on the ticket. Use when the user wants this pipeline run through their own Jira/GitHub MCP connections instead of a personal API token and the gh CLI.
---

# Jira → PR (MCP-native)

The same real pipeline as
[jira-to-pr-workflow](https://github.com/juan-rome/jira-to-pr-workflow):
fetch a ticket, gate it on quality, implement it, prove it visually,
explain it. The difference is transport, not judgment — Jira and GitHub
access go through the Atlassian and GitHub MCP servers the user already
connected to their own Claude Code, instead of a personal API token and
the `gh` CLI. The quality gate itself (`assessTicketQuality`) is imported
unchanged from that repo: refusing to implement an underspecified ticket
doesn't get weaker just because the transport changed.

```mermaid
flowchart TD
    A[Step 0: validate Jira + GitHub\nMCP connections] -->|either missing| Z[Stop. Print the exact\nclaude mcp add command]
    A -->|both connected| B[Call Atlassian MCP:\nfetch the ticket]
    B --> C[normalize-ticket-cli.mjs]
    C --> D{assessTicketQuality\nsufficient?}
    D -- no --> E[Stop. Tell the user\nwhat's missing]
    D -- yes --> F[Understand + implement]
    F --> G[Run the repo's own\nverification]
    G --> H[Call GitHub MCP:\ncreate the PR]
    H --> I[capture-screenshot.mjs]
    I --> J[Embed screenshot in PR]
    J --> K{User confirms\nclosing the loop?}
    K -- yes --> L[Call Atlassian MCP:\nattach + comment]
    K -- no --> M[Done — PR stands alone]
```

## When to use this

The user wants the Jira-to-PR pipeline run through their **own connected
MCP servers** rather than a personal API token — e.g. "work ticket X using
my Jira MCP connection." If they haven't connected Jira/GitHub via MCP and
don't specifically want to, use
[jira-to-pr-workflow](https://github.com/juan-rome/jira-to-pr-workflow)
instead; that version's REST/`gh`-CLI setup has fewer moving parts for a
one-off run.

## Setup (once)

```bash
claude mcp add --scope user --transport http atlassian https://mcp.atlassian.com/v2/mcp
```

Then, in a Claude Code session, run `/mcp`, select `atlassian`, and
authenticate via OAuth (browser popup).

GitHub's MCP endpoint does **not** support OAuth's dynamic client
registration — confirmed on the first real setup, not assumed — so it
needs a token in a header instead of `/mcp`:

```bash
claude mcp add --scope user --transport http github https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer YOUR_GITHUB_PAT"
```

Generate a fine-grained PAT at
[github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens),
scoped to only the repo(s) this will run against, with **Pull requests:
Read and write** (Metadata: Read-only is added automatically and is all
else this needs — no Contents access, since code changes are pushed via
your regular local git, not through this token).

Avoid the token landing in shell history: run `setopt histignorespace`
first, then prefix the `claude mcp add` line with a leading space.
`~/.claude.json` itself stores it in plaintext but is already
owner-only (`600`) — the same protection model `gh`/AWS CLI use for
their own token files.

`--scope user` makes both connections available to any skill on this
machine, not just this one, which is the actual point of using MCP here
instead of a per-skill token.

`npm install` in this skill's directory once (pulls in
`jira-to-pr-workflow` as a git dependency, for its quality gate and ADF
parser, and Playwright for `capture-screenshot.mjs`).

## Step 0 — Validate both MCP connections before touching a real ticket

Before fetching anything, confirm both servers are actually connected and
authenticated: make one lightweight call against each (e.g. the Atlassian
MCP server's Jira search/read tool against the ticket key the user gave
you, and the GitHub MCP server's "who am I" or repo-lookup equivalent).

**If either call fails or the server isn't connected, stop immediately**
and tell the user exactly which command to run:

- Jira not connected → `claude mcp add --scope user --transport http atlassian https://mcp.atlassian.com/v2/mcp`, then `/mcp`
- GitHub not connected → see **Setup (once)** above for the PAT-header command (GitHub's endpoint doesn't support `/mcp`'s OAuth flow)

Don't proceed partway through the pipeline on a guess that a connection
"probably" exists — a clear stop here is worth far more than a confusing
failure three steps in.

## Step 1 — Fetch the ticket via the Atlassian MCP server

Call the connected Atlassian MCP server's Jira read/search tool for the
ticket key directly — **do not** try to fetch it with a spawned script;
MCP tool calls only happen inside your own tool-use loop, not from a child
process. Then pipe the raw result through the CLI wrapper, using this
repo's **absolute path** (not a relative one, and don't `cd` into the
target repo first — the first real run hit exactly this: a script run
from outside this repo's own directory can't resolve the
`jira-to-pr-workflow` git dependency, since Node only walks up from the
running script's own location to find `node_modules`):

```bash
echo '{"mcpIssue": <raw MCP result>, "jiraSiteUrl": "https://your-domain.atlassian.net"}' \
  | node /absolute/path/to/jira-to-pr-workflow-mcp/scripts/normalize-ticket-cli.mjs
```

This prints `{ key, summary, description, acceptanceCriteria, testingPlan,
status, url, qualityCheck }` — the same shape v1's `fetch-ticket.mjs`
prints, regardless of whether the MCP server returned a raw ADF document
or an already-flattened plain-text description (`normalize-ticket.mjs`
handles both).

## Step 2 — Quality gate: don't implement an underspecified ticket

`normalize-ticket-cli.mjs`'s output already includes `qualityCheck`
(computed by the imported `assessTicketQuality`, unchanged from v1's
`quality-gate.mjs`). Check `qualityCheck.sufficient`. If it's `false`,
**stop before writing any code** and name what's missing. This logic is
intentionally not reimplemented here; both versions of this workflow must
agree on what counts as a ready ticket.

If the user wants to proceed anyway with the gaps named, that's their
call — the gap should be named out loud first, not silently papered over.

## Step 3 — Understand before implementing

Identical to `jira-to-pr-workflow`: read the summary, description, and
acceptance criteria together, find the actually-relevant files in the
current repo, and don't expand scope beyond what the ticket asks for.

## Step 4 — Implement and verify

Make the change. Run whatever this repo's real verification is
(typecheck/lint/tests/build) before considering the ticket done.

## Step 5 — Open the PR via the GitHub MCP server

**First, check for an existing PR referencing this ticket** using the
GitHub MCP server's PR search tool, so re-running this skill on the same
ticket updates the existing PR instead of opening a duplicate.

Build the body with `scripts/pr-body.mjs`'s `buildPrBody()` — it throws if
any required section (ticket link, what changed, tradeoffs, test plan) is
missing, so the PR can't go out incomplete. Then call the GitHub MCP
server's create-PR tool directly (not `gh pr create` — this version's
whole point is going through the connected MCP server).

### Attach a real screenshot, not just a text description

```bash
node scripts/capture-screenshot.mjs <url> screenshot.png [--selector "css-selector"]
```

Same as v1 — Playwright screenshotting has no MCP equivalent and isn't
Jira/GitHub-specific, so this script is copied over unchanged. Commit the
screenshot and embed it in the PR body via its raw GitHub URL.

## Step 6 — Close the loop (optional, ask first)

Confirm with the user before running either of these, same as any other
action with real-world visibility:

- **Attach the screenshot to the ticket.** Confirmed working (see
  `RUNS.md`): the Atlassian MCP server exposes a two-phase
  `uploadAttachmentToJiraIssue` tool — call it once to get an upload
  target/`fileId`, then again to complete the attachment.
- **Comment on the ticket with the PR link.** Confirmed working via the
  Atlassian MCP server's comment tool.

Mentioning a specific reviewer by name in that comment is still
unconfirmed — the first real run only posted a plain PR-link comment, not
one with a real Jira mention node. Don't assume "@Name" as literal text
notifies anyone; if you need a real mention, verify the tool supports one
before relying on it working.

## What's still unconfirmed

1. The exact shape the Atlassian MCP server's Jira read tool returns for
   `description` (raw ADF vs. already-flattened text) — `normalize-ticket.mjs`
   handles both, and the first real run didn't log which path fired.
2. Whether the Atlassian MCP server's comment tool supports a real
   @-mention node (only a plain PR-link comment has been tested so far).

See `RUNS.md` for what's actually been verified.

## Security considerations

Jira access is via OAuth, scoped and revocable from your Atlassian account
settings, with no personal token to manage. GitHub access still needs a
PAT (see **Setup**), since GitHub's MCP endpoint doesn't support OAuth's
dynamic client registration — scope that token to exactly the repo(s)
this runs against with Pull-requests-only access, same principle as v1's
"narrowest scope your site allows" for its own Jira token. Never pass a
token as a bare CLI argument without protecting shell history first (see
**Setup**) — `~/.claude.json` stores it in plaintext, protected only by
owner-only file permissions.

## What this skill does not do

Same as v1: it doesn't decide priority, negotiate scope with a PM, or
handle a ticket whose acceptance criteria are missing or contradictory —
surface that back to the user rather than guessing. It doesn't auto-merge.
It also doesn't yet confirm a real Jira @-mention works — see **What's
still unconfirmed** above.
