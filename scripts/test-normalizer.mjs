#!/usr/bin/env node
// Self-test for normalize-ticket.mjs against both response shapes it has to
// handle: a raw ADF document (the same shape Jira Cloud's REST API returns)
// and an already-flattened plain-text description. Real assertions, no test
// framework — matches jira-to-pr-workflow's own test style.

import { normalizeTicket } from "./normalize-ticket.mjs";
import { assessTicketQuality } from "jira-to-pr-workflow/scripts/quality-gate.mjs";

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  } else {
    console.log(`ok: ${message}`);
  }
}

const adfIssue = {
  key: "KAN-9",
  fields: {
    summary: "Add a live character counter to the feedback textarea",
    status: { name: "In Development" },
    description: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Users can't tell how much room is left." }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Acceptance Criteria" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Counter updates live" }] },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Testing Plan" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Type near the limit and confirm the color change." }],
        },
      ],
    },
  },
};

const adfTicket = normalizeTicket(adfIssue, "https://juan-rome.atlassian.net");
assert(adfTicket.key === "KAN-9", "ADF shape: key comes through unchanged");
assert(
  adfTicket.url === "https://juan-rome.atlassian.net/browse/KAN-9",
  "ADF shape: browse URL is built from the site + key"
);
assert(
  adfTicket.description.includes("Users can't tell how much room is left"),
  "ADF shape: description is flattened to plain text"
);
assert(
  adfTicket.acceptanceCriteria.includes("Counter updates live"),
  "ADF shape: acceptance criteria extracted from the ADF heading section"
);
assert(
  adfTicket.testingPlan.includes("Type near the limit"),
  "ADF shape: testing plan extracted from the ADF heading section"
);
assert(
  assessTicketQuality(adfTicket).sufficient === true,
  "ADF shape: a well-specified ticket passes the imported quality gate unchanged"
);

const plainTextIssue = {
  key: "KAN-10",
  fields: {
    summary: "Fix the button",
    status: { name: "To Do" },
    description: "it's broken",
  },
};

const plainTicket = normalizeTicket(plainTextIssue, "https://juan-rome.atlassian.net/");
assert(
  plainTicket.url === "https://juan-rome.atlassian.net/browse/KAN-10",
  "plain-text shape: a trailing slash on the site URL doesn't produce a double slash"
);
assert(plainTicket.description === "it's broken", "plain-text shape: description passed through as-is");
assert(
  plainTicket.acceptanceCriteria === "",
  "plain-text shape: no AC heading found returns empty string, not undefined"
);
assert(
  assessTicketQuality(plainTicket).sufficient === false,
  "plain-text shape: a one-line ticket still fails the same imported quality gate"
);

const plainTextWithSections = {
  key: "KAN-11",
  fields: {
    summary: "Add a settings toggle",
    status: { name: "To Do" },
    description:
      "Users need a way to opt out.\n\nAcceptance Criteria\nToggle persists across reloads\nDefaults to off\n\nTesting Plan\nToggle it, reload, confirm it stuck",
  },
};

const sectionedTicket = normalizeTicket(plainTextWithSections, "https://juan-rome.atlassian.net");
assert(
  sectionedTicket.acceptanceCriteria.includes("Toggle persists across reloads"),
  "plain-text shape: acceptance criteria extracted from an unmarked heading line"
);
assert(
  sectionedTicket.testingPlan.includes("Toggle it, reload, confirm it stuck"),
  "plain-text shape: testing plan extracted from an unmarked heading line"
);
assert(
  !sectionedTicket.acceptanceCriteria.includes("Testing Plan"),
  "plain-text shape: acceptance criteria extraction stops before the next heading"
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll assertions passed.");
