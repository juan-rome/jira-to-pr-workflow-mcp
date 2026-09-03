#!/usr/bin/env node
// Self-test for pr-body.mjs. No test framework — matches jira-to-pr-workflow's
// own test style.

import { buildPrBody } from "./pr-body.mjs";

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  } else {
    console.log(`ok: ${message}`);
  }
}

const body = buildPrBody({
  ticketUrl: "https://juan-rome.atlassian.net/browse/KAN-9",
  whatChanged: "Added a live character counter under the feedback textarea.",
  tradeoffs: "None — the AC was unambiguous about the exact behavior.",
  testPlan: "Typed near the limit locally and confirmed the color change.",
});

assert(body.includes("**Ticket:** https://juan-rome.atlassian.net/browse/KAN-9"), "includes the ticket link");
assert(body.includes("**What changed:**"), "includes the What changed section header");
assert(body.includes("**Tradeoffs:**"), "includes the Tradeoffs section header");
assert(body.includes("**Test plan:**"), "includes the Test plan section header");
assert(
  body.includes("Added a live character counter under the feedback textarea."),
  "includes the actual what-changed content"
);

let threw = false;
try {
  buildPrBody({ ticketUrl: "https://example.com", whatChanged: "x", tradeoffs: "y", testPlan: "" });
} catch (error) {
  threw = true;
  assert(
    error.message.includes("testPlan"),
    "the error names exactly which section was missing"
  );
}
assert(threw, "a missing required section throws rather than silently producing an incomplete PR body");

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll assertions passed.");
