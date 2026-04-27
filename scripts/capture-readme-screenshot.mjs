#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const defaults = {
  output: "images/readme-screenshot.png",
  port: 4174,
  runSample: true,
  time: "2026-04-25T10:30:00.000+01:00",
  timezone: "Europe/Dublin",
  locale: "en-US",
  viewport: {
    width: 1920,
    height: 1080,
  },
};

function readBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

function readViewport(value) {
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

function resolveProjectPath(value) {
  return path.isAbsolute(value) ? value : path.join(projectRoot, value);
}

function parseArgs(argv) {
  const options = {
    url: process.env.README_SCREENSHOT_URL,
    output: resolveProjectPath(process.env.README_SCREENSHOT_OUTPUT ?? defaults.output),
    port: Number(process.env.README_SCREENSHOT_PORT ?? defaults.port),
    runSample: readBoolean(process.env.README_SCREENSHOT_RUN_SAMPLE, defaults.runSample),
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
        options.runSample = false;
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

function printHelp() {
  console.log(`
Usage: npm run screenshot:readme -- [options]

Options:
  --url <url>              Capture an already running app instead of starting Vite.
  --output <path>          Screenshot output path. Default: ${defaults.output}
  --viewport <WxH>         Browser viewport. Default: ${defaults.viewport.width}x${defaults.viewport.height}
  --port <port>            Preferred local Vite port. Default: ${defaults.port}
  --time <iso-date>        Fixed browser time for deterministic screenshots.
  --timezone <tz>          Browser timezone. Default: ${defaults.timezone}
  --locale <locale>        Browser locale. Default: ${defaults.locale}
  --no-run-sample          Capture the initial app state without running sample macros.
  --full-page              Capture the full page instead of the viewport.

Environment variables mirror the options with README_SCREENSHOT_* names.
`.trim());
}

async function startViteServer(options) {
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

  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      close().finally(() => {
        reject(new Error(`Timed out waiting for Vite to start.\n${output.trim()}`));
      });
    }, 30000);

    const readChunk = (chunk) => {
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

async function installFixedClock(page, isoDate) {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid fixed time "${isoDate}". Use an ISO date string.`);
  }

  await page.addInitScript((fixedTimestamp) => {
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
  }, timestamp);
}

async function waitForAppReady(page, options) {
  await page.locator("#workspace").waitFor({ state: "visible", timeout: 15000 });
  await page.locator(".file-name", { hasText: "sample-roomos-macro" }).waitFor({
    state: "visible",
    timeout: 15000,
  });

  if (options.runSample) {
    await page.getByRole("button", { name: "Run Enabled Macros" }).click();
    await page.locator(".alert-card", { hasText: "Welcome to the simulator" }).waitFor({
      state: "visible",
      timeout: 10000,
    });
  }

  await Promise.race([
    page.locator("#code-editor", { hasText: "import xapi from 'xapi';" }).waitFor({ timeout: 10000 }),
    page.locator(".log-line.error", { hasText: "Monaco" }).waitFor({ timeout: 10000 }),
    page.waitForTimeout(2500),
  ]);

  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
  await page.waitForTimeout(500);
}

async function captureScreenshot(options) {
  let ownedServer = null;
  let browser = null;

  try {
    ownedServer = options.url ? null : await startViteServer(options);
    const appUrl = options.url ?? ownedServer.url;

    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: options.viewport,
      deviceScaleFactor: 1,
      colorScheme: "dark",
      timezoneId: options.timezone,
      locale: options.locale,
    });
    const page = await context.newPage();

    const pageErrors = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error);
    });

    await installFixedClock(page, options.time);
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await waitForAppReady(page, options);

    if (pageErrors.length > 0) {
      throw pageErrors[0];
    }

    await fs.mkdir(path.dirname(options.output), { recursive: true });
    await page.screenshot({
      path: options.output,
      fullPage: options.fullPage,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    });

    return {
      output: options.output,
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
  console.log(`Saved README screenshot from ${result.url} to ${path.relative(projectRoot, result.output)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
