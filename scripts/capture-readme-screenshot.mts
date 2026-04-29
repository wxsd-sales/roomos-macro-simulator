#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

interface ViewportSize {
  width: number;
  height: number;
}

type ScreenshotTheme = "light" | "dark";
type ScreenshotThemeOption = ScreenshotTheme | "both";
type ScreenshotState = "before" | "after";
type ScreenshotStateOption = ScreenshotState | "both";

interface ScreenshotOptions {
  url?: string;
  output: string;
  theme: ScreenshotThemeOption;
  state: ScreenshotStateOption;
  port: number;
  fullPage: boolean;
  time: string;
  timezone: string;
  locale: string;
  viewport: ViewportSize;
}

interface OwnedServer {
  url: string;
  close(): Promise<void>;
}

interface CaptureResult {
  outputs: Array<{
    output: string;
    state: ScreenshotState;
    theme: ScreenshotTheme;
  }>;
  url: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const defaults = {
  output: "screenshots/readme-screenshot-{state}-{theme}.png",
  theme: "both" as ScreenshotThemeOption,
  state: "both" as ScreenshotStateOption,
  port: 4174,
  time: "2026-04-25T10:30:00.000+01:00",
  timezone: "Europe/Dublin",
  locale: "en-US",
  viewport: {
    width: 1920,
    height: 1080,
  },
};

const THEME_STORAGE_KEY = "roomos-macro-simulator-theme";

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

function readViewport(value: string | undefined): ViewportSize {
  if (!value) {
    return defaults.viewport;
  }

  const match = String(value).match(/^(\d+)x(\d+)$/);
  if (!match) {
    throw new Error(`Invalid viewport "${value}". Expected WIDTHxHEIGHT, for example 1440x900.`);
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function readTheme(value: string | undefined): ScreenshotThemeOption {
  if (value === undefined) {
    return defaults.theme;
  }

  if (value === "light" || value === "dark" || value === "both") {
    return value;
  }

  throw new Error(`Invalid theme "${value}". Expected light, dark, or both.`);
}

function readState(value: string | undefined): ScreenshotStateOption {
  if (value === undefined) {
    return defaults.state;
  }

  if (value === "before" || value === "after" || value === "both") {
    return value;
  }

  throw new Error(`Invalid state "${value}". Expected before, after, or both.`);
}

function resolveProjectPath(value: string): string {
  return path.isAbsolute(value) ? value : path.join(projectRoot, value);
}

function parseArgs(argv: string[]): ScreenshotOptions {
  const legacyRunSampleState =
    process.env.README_SCREENSHOT_RUN_SAMPLE === undefined
      ? undefined
      : readBoolean(process.env.README_SCREENSHOT_RUN_SAMPLE, true)
        ? "after"
        : "before";

  const options: ScreenshotOptions = {
    url: process.env.README_SCREENSHOT_URL,
    output: resolveProjectPath(process.env.README_SCREENSHOT_OUTPUT ?? defaults.output),
    theme: readTheme(process.env.README_SCREENSHOT_THEME),
    state: readState(process.env.README_SCREENSHOT_STATE ?? legacyRunSampleState),
    port: Number(process.env.README_SCREENSHOT_PORT ?? defaults.port),
    fullPage: readBoolean(process.env.README_SCREENSHOT_FULL_PAGE, false),
    time: process.env.README_SCREENSHOT_TIME ?? defaults.time,
    timezone: process.env.README_SCREENSHOT_TIMEZONE ?? defaults.timezone,
    locale: process.env.README_SCREENSHOT_LOCALE ?? defaults.locale,
    viewport: readViewport(process.env.README_SCREENSHOT_VIEWPORT),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (!argv[index]) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[index];
    };

    switch (arg) {
      case "--url":
        options.url = next();
        break;
      case "--output":
        options.output = resolveProjectPath(next());
        break;
      case "--theme":
        options.theme = readTheme(next());
        break;
      case "--state":
        options.state = readState(next());
        break;
      case "--viewport":
        options.viewport = readViewport(next());
        break;
      case "--port":
        options.port = Number(next());
        break;
      case "--time":
        options.time = next();
        break;
      case "--timezone":
        options.timezone = next();
        break;
      case "--locale":
        options.locale = next();
        break;
      case "--no-run-sample":
        options.state = "before";
        break;
      case "--full-page":
        options.fullPage = true;
        break;
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.port) || options.port < 1) {
    throw new Error(`Invalid port "${options.port}".`);
  }

  return options;
}

function printHelp(): void {
  console.log(`
Usage: npm run screenshot:readme -- [options]

Options:
  --url <url>              Capture an already running app instead of starting Vite.
  --output <path>          Screenshot output path. Use {state} and {theme}. Default: ${defaults.output}
  --theme <theme>          Capture light, dark, or both. Default: ${defaults.theme}
  --state <state>          Capture before, after, or both. Default: ${defaults.state}
  --viewport <WxH>         Browser viewport. Default: ${defaults.viewport.width}x${defaults.viewport.height}
  --port <port>            Preferred local Vite port. Default: ${defaults.port}
  --time <iso-date>        Fixed browser time for deterministic screenshots.
  --timezone <tz>          Browser timezone. Default: ${defaults.timezone}
  --locale <locale>        Browser locale. Default: ${defaults.locale}
  --no-run-sample          Capture only the initial before state. Alias for --state before.
  --full-page              Capture the full page instead of the viewport.

Environment variables mirror the options with README_SCREENSHOT_* names.
When capturing multiple themes or states without {theme} or {state} in the output path, the missing values are appended before the file extension.
`.trim());
}

function getCaptureThemes(theme: ScreenshotThemeOption): ScreenshotTheme[] {
  return theme === "both" ? ["light", "dark"] : [theme];
}

function getCaptureStates(state: ScreenshotStateOption): ScreenshotState[] {
  return state === "both" ? ["before", "after"] : [state];
}

function appendOutputSuffix(output: string, suffixes: string[]): string {
  if (!suffixes.length) {
    return output;
  }

  const parsedOutput = path.parse(output);
  const extension = parsedOutput.ext || ".png";
  return path.join(parsedOutput.dir, `${parsedOutput.name}-${suffixes.join("-")}${extension}`);
}

function getOutputForCapture(
  output: string,
  theme: ScreenshotTheme,
  state: ScreenshotState,
  hasMultipleThemes: boolean,
  hasMultipleStates: boolean,
): string {
  const hasThemePlaceholder = output.includes("{theme}");
  const hasStatePlaceholder = output.includes("{state}");
  const resolvedOutput = output.replaceAll("{theme}", theme).replaceAll("{state}", state);
  const suffixes = [];

  if (!hasStatePlaceholder && hasMultipleStates) {
    suffixes.push(state);
  }

  if (!hasThemePlaceholder && hasMultipleThemes) {
    suffixes.push(theme);
  }

  if (!suffixes.length) {
    return resolvedOutput;
  }

  if (hasThemePlaceholder || hasStatePlaceholder) {
    return appendOutputSuffix(resolvedOutput, suffixes);
  }

  if (!hasMultipleThemes && !hasMultipleStates) {
    return output;
  }

  return appendOutputSuffix(resolvedOutput, suffixes);
}

async function startViteServer(options: ScreenshotOptions): Promise<OwnedServer> {
  const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
  const serverProcess = spawn(
    process.execPath,
    [
      viteBin,
      "--host",
      "127.0.0.1",
      "--port",
      String(options.port),
      "--clearScreen",
      "false",
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        BROWSER: "none",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";
  let settled = false;

  const close = async () => {
    if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
      return;
    }

    const exit = once(serverProcess, "exit").catch(() => {});
    serverProcess.kill("SIGTERM");
    const forceKill = setTimeout(() => {
      serverProcess.kill("SIGKILL");
    }, 3000);
    await exit;
    clearTimeout(forceKill);
  };

  const url = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      close().finally(() => {
        reject(new Error(`Timed out waiting for Vite to start.\n${output.trim()}`));
      });
    }, 30000);

    const readChunk = (chunk: Buffer) => {
      output += chunk.toString();
      const cleanedOutput = output.replace(/\u001b\[[0-9;]*m/g, "");
      const match = cleanedOutput.match(/http:\/\/127\.0\.0\.1:\d+\/?/);
      if (!match || settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve(match[0].endsWith("/") ? match[0] : `${match[0]}/`);
    };

    serverProcess.stdout.on("data", readChunk);
    serverProcess.stderr.on("data", readChunk);
    serverProcess.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    serverProcess.once("exit", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`Vite exited before starting (code ${code}, signal ${signal}).\n${output.trim()}`));
    });
  });

  return { url, close };
}

async function installFixedClock(page: Page, isoDate: string): Promise<void> {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid fixed time "${isoDate}". Use an ISO date string.`);
  }

  await page.addInitScript({
    content: `
      (() => {
        const fixedTimestamp = ${JSON.stringify(timestamp)};
        const RealDate = Date;

        class FixedDate extends RealDate {
          constructor(...args) {
            if (args.length === 0) {
              super(fixedTimestamp);
              return;
            }

            super(...args);
          }

          static now() {
            return fixedTimestamp;
          }
        }

        FixedDate.UTC = RealDate.UTC;
        FixedDate.parse = RealDate.parse;
        FixedDate.prototype = RealDate.prototype;
        window.Date = FixedDate;
      })();
    `,
  });
}

async function installThemePreference(page: Page, theme: ScreenshotTheme): Promise<void> {
  await page.addInitScript({
    content: `
      (() => {
        localStorage.setItem(${JSON.stringify(THEME_STORAGE_KEY)}, ${JSON.stringify(theme)});
      })();
    `,
  });
}

async function waitForAppReady(page: Page): Promise<void> {
  await page.locator("#workspace").waitFor({ state: "visible", timeout: 15000 });
  await page.locator(".file-name", { hasText: "sample-roomos-macro" }).waitFor({
    state: "visible",
    timeout: 15000,
  });

  await Promise.race([
    page.locator("#code-editor", { hasText: "import xapi from 'xapi';" }).waitFor({ timeout: 10000 }),
    page.locator(".log-line.error", { hasText: "Monaco" }).waitFor({ timeout: 10000 }),
    page.waitForTimeout(2500),
  ]);

  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
  await page.waitForTimeout(500);
}

async function runSampleMacros(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Run Enabled Macros" }).click();
  await page.locator(".osd-alert-card", { hasText: "Welcome to the simulator" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.locator(".controller-alert-card", { hasText: "Welcome to the simulator" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.waitForTimeout(500);
}

async function saveScreenshot(page: Page, output: string, fullPage: boolean): Promise<void> {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await page.screenshot({
    path: output,
    fullPage,
    animations: "disabled",
    caret: "hide",
    scale: "css",
  });
}

async function captureThemeScreenshots(
  browser: Browser,
  appUrl: string,
  options: ScreenshotOptions,
  theme: ScreenshotTheme,
  outputs: Array<{
    output: string;
    state: ScreenshotState;
  }>,
): Promise<void> {
  const context = await browser.newContext({
    viewport: options.viewport,
    deviceScaleFactor: 1,
    colorScheme: theme,
    timezoneId: options.timezone,
    locale: options.locale,
  });
  const page = await context.newPage();

  try {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error);
    });

    await installThemePreference(page, theme);
    await installFixedClock(page, options.time);
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await waitForAppReady(page);

    if (pageErrors.length > 0) {
      throw pageErrors[0];
    }

    let hasRunSample = false;
    for (const { state, output } of outputs) {
      if (state === "after" && !hasRunSample) {
        await runSampleMacros(page);
        hasRunSample = true;

        if (pageErrors.length > 0) {
          throw pageErrors[0];
        }
      }

      await saveScreenshot(page, output, options.fullPage);
    }
  } finally {
    await context.close();
  }
}

async function captureScreenshot(options: ScreenshotOptions): Promise<CaptureResult> {
  let ownedServer: OwnedServer | null = null;
  let browser: Browser | null = null;

  try {
    ownedServer = options.url ? null : await startViteServer(options);
    const appUrl = options.url ?? ownedServer?.url;
    if (!appUrl) {
      throw new Error("Unable to determine app URL for screenshot capture.");
    }

    browser = await chromium.launch();
    const themes = getCaptureThemes(options.theme);
    const states = getCaptureStates(options.state);
    const outputs = themes.flatMap((theme) =>
      states.map((state) => ({
        theme,
        state,
        output: getOutputForCapture(options.output, theme, state, themes.length > 1, states.length > 1),
      })),
    );

    for (const theme of themes) {
      await captureThemeScreenshots(
        browser,
        appUrl,
        options,
        theme,
        outputs.filter((output) => output.theme === theme),
      );
    }

    return {
      outputs,
      url: appUrl,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
    if (ownedServer) {
      await ownedServer.close();
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await captureScreenshot(options);
  for (const { output, state, theme } of result.outputs) {
    console.log(
      `Saved ${state} ${theme} README screenshot from ${result.url} to ${path.relative(projectRoot, output)}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
