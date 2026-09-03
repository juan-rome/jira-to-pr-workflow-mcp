# Real runs

No live run yet.

This repo's Jira/GitHub access depends on an interactive `/mcp` OAuth
login, which a non-interactive coding session can't complete — so unlike
[jira-to-pr-workflow](https://github.com/juan-rome/jira-to-pr-workflow)'s
`RUNS.md` (two real tickets processed against a live Jira sandbox), this
one starts empty on purpose rather than describing a run that didn't
happen.

What's actually been verified so far is fixture-based: `npm test` checks
`normalize-ticket.mjs` against both response shapes it has to handle (raw
ADF and already-flattened text), confirms the imported
`assessTicketQuality` gate behaves identically to v1's own fixture tests,
and checks that `pr-body.mjs` refuses to build an incomplete PR body.

Once a real run happens — connect both MCP servers, ask Claude to work a
real ticket end to end — this file gets a real entry the same way v1's
does: the ticket, the actual quality-gate verdict, the PR, and (per
SKILL.md's open questions) whether Step 6's attach/comment tools turned
out to be supported by the Atlassian MCP server or not.
