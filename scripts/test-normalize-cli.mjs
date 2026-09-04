#!/usr/bin/env node
// Self-test for normalize-ticket-cli.mjs — specifically regression-testing
// the bug found in this repo's first real run: a script that isn't inside
// this repo's own directory can't resolve the jira-to-pr-workflow git
// dependency. This runs the CLI via its absolute path from a *different*
// cwd (os.tmpdir()) to prove that's actually fixed, not just fixed "on my
// machine from the right directory."

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, "normalize-ticket-cli.mjs");

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  } else {
    console.log(`ok: ${message}`);
  }
}

const input = JSON.stringify({
  mcpIssue: {
    key: "KAN-99",
    fields: {
      summary: "Test ticket",
      status: { name: "To Do" },
      description: "one line, nothing else",
    },
  },
  jiraSiteUrl: "https://juan-rome.atlassian.net",
});

const output = execFileSync("node", [cliPath], {
  input,
  cwd: os.tmpdir(),
  encoding: "utf-8",
});

const result = JSON.parse(output);

assert(result.key === "KAN-99", "CLI run from an unrelated cwd still resolves and returns the ticket key");
assert(
  result.url === "https://juan-rome.atlassian.net/browse/KAN-99",
  "CLI output includes the built browse URL"
);
assert(
  result.qualityCheck.sufficient === false,
  "CLI output includes the imported quality gate's verdict on a sparse ticket"
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll assertions passed.");
