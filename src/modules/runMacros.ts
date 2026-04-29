import type { AddLog, AppFile } from "./types.ts";
import type { XapiFacade } from "./xapi/facade.ts";

interface RunMacrosOptions {
  files: AppFile[];
  addLog: AddLog;
  createXapiFacade: () => XapiFacade;
}

interface MacroConsole {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

type MacroRunner = (xapi: XapiFacade, console: MacroConsole) => unknown;

function normalizeMacroSource(source: string): string {
  return source
    .replace(/import\s+xapi\s+from\s+['"]xapi['"];?/g, "")
    .replace(/const\s+xapi\s*=\s*require\(['"]xapi['"]\);?/g, "");
}

function formatConsoleArgs(args: unknown[]): string {
  return args.map((arg) => String(arg)).join(" ");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runMacros({ files, addLog, createXapiFacade }: RunMacrosOptions): Promise<void> {
  const enabledFiles = files.filter((file) => file.enabled);
  if (!enabledFiles.length) {
    addLog("No enabled macros to run.", "error");
    return;
  }

  const xapi = createXapiFacade();
  addLog(`Executing ${enabledFiles.length} enabled macro${enabledFiles.length === 1 ? "" : "s"}.`, "success");

  for (const file of enabledFiles) {
    try {
      const executableSource = normalizeMacroSource(file.content);
      const runner = new Function(
        "xapi",
        "console",
        `"use strict";\n${executableSource}`,
      ) as MacroRunner;
      const simulatorConsole: MacroConsole = {
        log: (...args) => addLog(`${file.name}: ${formatConsoleArgs(args)}`),
        error: (...args) => addLog(`${file.name}: ${formatConsoleArgs(args)}`, "error"),
      };

      const result = runner(xapi, simulatorConsole);
      if (result instanceof Promise) {
        await result;
      }
      addLog(`Executed ${file.name}`, "success");
    } catch (error) {
      addLog(`Execution failed for ${file.name}: ${getErrorMessage(error)}`, "error");
    }
  }
}
