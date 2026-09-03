// Builds the PR body markdown from structured parts, so the required
// sections (ticket link, what changed, tradeoffs, test plan) are always
// present and consistently formatted, regardless of which MCP tool ends up
// creating the PR. Mirrors the exact structure jira-to-pr-workflow's
// SKILL.md instructs Claude to write by hand — here it's a real function,
// so a missing section is a thrown error, not a silently incomplete PR.

export function buildPrBody({ ticketUrl, whatChanged, tradeoffs, testPlan }) {
  const missing = ["ticketUrl", "whatChanged", "tradeoffs", "testPlan"].filter(
    (key) => !{ ticketUrl, whatChanged, tradeoffs, testPlan }[key]
  );
  if (missing.length > 0) {
    throw new Error(
      `buildPrBody missing required section(s): ${missing.join(", ")} — a missing section is exactly what jira-to-pr-workflow's PR template exists to prevent.`
    );
  }

  return [
    `**Ticket:** ${ticketUrl}`,
    "",
    "**What changed:**",
    whatChanged,
    "",
    "**Tradeoffs:**",
    tradeoffs,
    "",
    "**Test plan:**",
    testPlan,
  ].join("\n");
}
