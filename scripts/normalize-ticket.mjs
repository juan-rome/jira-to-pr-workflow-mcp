// Normalizes whatever shape the connected Atlassian MCP server returns for
// a Jira issue into the same { key, summary, description, acceptanceCriteria,
// testingPlan, status, url } shape jira-to-pr-workflow's quality-gate.mjs
// expects, so the imported gate behaves identically regardless of whether a
// ticket arrived via v1's REST client or v2's MCP call.
//
// The Atlassian MCP server's exact Jira response schema isn't confirmed yet
// (its docs describe permission groups like read_jira/search_jira, not a
// field-by-field response shape) — this handles the two shapes a Jira-backed
// MCP tool is realistically going to return: a raw ADF document (the same
// shape Jira Cloud's REST API returns, since MCP servers built on that API
// commonly proxy it directly) or an already-flattened plain-text/markdown
// string. Whichever it actually is gets confirmed on the first live run —
// see RUNS.md — and this file is the one place that would need updating.

import {
  adfToText,
  extractAcceptanceCriteria,
  extractTestingPlan,
} from "jira-to-pr-workflow/scripts/adf.mjs";

function isAdfDocument(value) {
  return typeof value === "object" && value !== null && typeof value.type === "string";
}

const PLAIN_TEXT_HEADINGS = {
  acceptanceCriteria: /^#{0,3}\s*acceptance criteria\s*:?$/i,
  testingPlan: /^#{0,3}\s*(test(ing)? plan|qa plan|how to test)\s*:?$/i,
};

function isHeadingLine(line) {
  const trimmed = line.trim();
  return (
    Object.values(PLAIN_TEXT_HEADINGS).some((pattern) => pattern.test(trimmed)) ||
    /^#{1,3}\s+\S/.test(trimmed)
  );
}

function extractPlainTextSection(text, key) {
  if (!text) return "";
  const lines = text.split("\n");
  const startIndex = lines.findIndex((line) => PLAIN_TEXT_HEADINGS[key].test(line.trim()));
  if (startIndex === -1) return "";

  const collected = [];
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (isHeadingLine(lines[i])) break;
    collected.push(lines[i]);
  }
  return collected.join("\n").trim();
}

/**
 * @param {object} mcpIssue - whatever the Atlassian MCP server's Jira read
 *   tool returned for one issue.
 * @param {string} jiraSiteUrl - e.g. "https://your-domain.atlassian.net",
 *   needed to build the browse URL since the MCP response may not include
 *   the full issue URL.
 */
export function normalizeTicket(mcpIssue, jiraSiteUrl) {
  const key = mcpIssue.key;
  const summary = mcpIssue.fields?.summary ?? mcpIssue.summary;
  const description = mcpIssue.fields?.description ?? mcpIssue.description;
  const status = mcpIssue.fields?.status?.name ?? mcpIssue.status ?? null;

  const usingAdf = isAdfDocument(description);

  return {
    key,
    summary,
    description: usingAdf ? adfToText(description) : (description ?? ""),
    acceptanceCriteria: usingAdf
      ? extractAcceptanceCriteria(description)
      : extractPlainTextSection(description, "acceptanceCriteria"),
    testingPlan: usingAdf
      ? extractTestingPlan(description)
      : extractPlainTextSection(description, "testingPlan"),
    status,
    url: `${jiraSiteUrl.replace(/\/$/, "")}/browse/${key}`,
  };
}
