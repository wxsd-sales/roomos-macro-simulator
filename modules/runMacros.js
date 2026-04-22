function normalizeMacroSource(source) {
  return source
    .replace(/import\s+xapi\s+from\s+['"]xapi['"];?/g, "")
    .replace(/const\s+xapi\s*=\s*require\(['"]xapi['"]\);?/g, "");
}

export async function runMacros({ files, addLog, createXapiFacade }) {
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
      );
      const simulatorConsole = {
        log: (...args) => addLog(`${file.name}: ${args.join(" ")}`),
        error: (...args) => addLog(`${file.name}: ${args.join(" ")}`, "error"),
      };

      const result = runner(xapi, simulatorConsole);
      if (result instanceof Promise) {
        await result;
      }
      addLog(`Executed ${file.name}`, "success");
    } catch (error) {
      addLog(`Execution failed for ${file.name}: ${error.message}`, "error");
    }
  }
}
