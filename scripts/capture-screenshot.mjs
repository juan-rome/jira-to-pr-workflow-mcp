#!/usr/bin/env node
// Captures a screenshot of a rendered page (or a specific element on it)
// via Playwright. Used to attach real visual evidence of a change to the
// Jira ticket and the PR, rather than asking a reviewer to trust a text
// description of what changed.
//
// Usage:
//   node scripts/capture-screenshot.mjs <url> <output-path> [--selector "css-selector"]
//   node scripts/capture-screenshot.mjs <url> <output-path> --fill "#message" "some text"
//     ^ --fill is repeatable, for setting up form state (e.g. showing a
//       near-limit or validation-error state) before the screenshot is
//       taken, rather than only ever capturing whatever a page loads with.

import { chromium } from "playwright";
import path from "node:path";
import { mkdir } from "node:fs/promises";

function parseArgs(argv) {
  const args = { url: null, out: null, selector: null, fills: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--selector") {
      args.selector = argv[++i];
    } else if (argv[i] === "--fill") {
      args.fills.push({ selector: argv[++i], value: argv[++i] });
    } else if (!args.url) {
      args.url = argv[i];
    } else if (!args.out) {
      args.out = argv[i];
    }
  }
  return args;
}

async function main() {
  const { url, out, selector, fills } = parseArgs(process.argv.slice(2));
  if (!url || !out) {
    console.error(
      'Usage: node scripts/capture-screenshot.mjs <url> <output-path> [--selector "css"] [--fill "css" "value"]'
    );
    process.exit(1);
  }

  await mkdir(path.dirname(path.resolve(out)), { recursive: true });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });

    for (const { selector: fillSelector, value } of fills) {
      await page.locator(fillSelector).fill(value);
    }

    if (selector) {
      await page.locator(selector).screenshot({ path: out });
    } else {
      await page.screenshot({ path: out, fullPage: true });
    }
    console.log(`Screenshot saved to ${out}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("capture-screenshot failed:", error.message);
  process.exit(1);
});
