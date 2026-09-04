#!/usr/bin/env node
// CLI wrapper around normalize-ticket.mjs so Claude never has to write a
// throwaway script to call it — the first real run hit exactly that: a
// script written outside this repo's own directory can't resolve the
// "jira-to-pr-workflow" git dependency, because Node's bare-specifier
// resolution only walks up from the *running script's own location* to
// find node_modules. Run this one from anywhere via its absolute path (or
// `cd` into this repo first) and it resolves correctly either way, since
// it lives inside this repo's own scripts/ directory.
//
// Usage:
//   echo '{"mcpIssue": {...}, "jiraSiteUrl": "https://your-domain.atlassian.net"}' \
//     | node /absolute/path/to/jira-to-pr-workflow-mcp/scripts/normalize-ticket-cli.mjs
//
// Reads { mcpIssue, jiraSiteUrl } as JSON on stdin (mcpIssue is whatever the
// Atlassian MCP server's Jira tool returned for one issue). Prints the same
// { key, summary, description, acceptanceCriteria, testingPlan, status, url,
// qualityCheck } shape v1's fetch-ticket.mjs prints, so both versions of
// this workflow hand Claude an identical result shape regardless of
// transport.

import { normalizeTicket } from "./normalize-ticket.mjs";
import { assessTicketQuality } from "jira-to-pr-workflow/scripts/quality-gate.mjs";

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    console.error(
      'Usage: echo \'{"mcpIssue": {...}, "jiraSiteUrl": "https://your-domain.atlassian.net"}\' | node normalize-ticket-cli.mjs'
    );
    process.exit(1);
  }

  const { mcpIssue, jiraSiteUrl } = JSON.parse(raw);
  const ticket = normalizeTicket(mcpIssue, jiraSiteUrl);
  console.log(JSON.stringify({ ...ticket, qualityCheck: assessTicketQuality(ticket) }, null, 2));
}

main().catch((error) => {
  console.error("normalize-ticket-cli failed:", error.message);
  process.exit(1);
});
