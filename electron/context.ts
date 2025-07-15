import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { runAppleScript } from "./tools.js";

const execFile = promisify(execFileCb);

const BROWSERS = [
  "Google Chrome",
  "Safari",
  "Arc",
  "Firefox",
  "Microsoft Edge",
  "Brave Browser",
  "Opera",
];

export interface CapturedContext {
  text: string;
  screenshotBase64: string;
  screenshotPath: string;
}

/**
 * Gather full context: focused app, browser URL/title, and screenshot.
 * The overlay window uses setContentProtection(true) so it never appears
 * in screenshots — no need to hide/show it.
 */
export async function captureContext(): Promise<CapturedContext> {
  const [text, screenshot] = await Promise.all([
    gatherTextContext(),
    captureScreen(),
  ]);

  console.log("[context] captured:");
  console.log(text);
  console.log(`[context] screenshot: ${screenshot.filePath}`);

  return {
    text,
    screenshotBase64: screenshot.base64,
    screenshotPath: screenshot.filePath,
  };
}

// ─── Internals ────────────────────────────────────────────────────────────────

async function gatherTextContext(): Promise<string> {
  let app = "";
  try {
    app = await runAppleScript(
      'tell application "System Events" to get name of first application process whose frontmost is true',
    );
  } catch {
    return "[Context] Could not determine focused app";
  }

  let ctx = `[Context] Focused app: ${app}`;

  const matchedBrowser = BROWSERS.find((b) =>
    app.toLowerCase().includes(b.toLowerCase()),
  );
  if (matchedBrowser) {
    try {
      let url = "";
      let title = "";
      if (matchedBrowser === "Safari") {
        url = await runAppleScript(
          'tell application "Safari" to get URL of front document',
        );
        title = await runAppleScript(
          'tell application "Safari" to get name of front document',
        );
      } else {
        url = await runAppleScript(
          `tell application "${matchedBrowser}" to get URL of active tab of front window`,
        );
        title = await runAppleScript(
          `tell application "${matchedBrowser}" to get title of active tab of front window`,
        );
      }
      if (url) ctx += `\n[Context] Browser URL: ${url}`;
      if (title) ctx += `\n[Context] Page title: ${title}`;
    } catch {
      // Browser may not be scriptable or no window open
    }
  }

  return ctx;
}

interface ScreenCapture {
  base64: string;
  filePath: string;
}

async function captureScreen(): Promise<ScreenCapture> {
  const filePath = path.join(tmpdir(), `agy-ctx-${Date.now()}.png`);
  await execFile("screencapture", ["-x", "-C", filePath]);
  const buf = await readFile(filePath);
  return { base64: buf.toString("base64"), filePath };
}
