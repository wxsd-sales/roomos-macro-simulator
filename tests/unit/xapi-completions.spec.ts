import ts from "typescript";
import { describe, expect, it } from "vitest";
import { buildXapiDeclarations } from "../../src/modules/editor/xapiDeclarations.ts";
import { buildSchemaRoots } from "../../src/modules/xapi/schema.ts";
import pinnedSchema from "../../src/modules/xapi/pinnedSchema.json";

/**
 * Drives the same TypeScript language service that backs Monaco's JavaScript
 * worker, using the compiler options from `xapiIntellisense.ts`. This is the
 * regression guard for `xapi.<TAB>` producing no suggestions.
 */
const DECLARATIONS_PATH = "/xapi-globals.d.ts";
const MODEL_PATH = "inmemory://model/1";

const declarations = buildXapiDeclarations(buildSchemaRoots(pinnedSchema), "test");
const libPath = ts.getDefaultLibFilePath({ target: ts.ScriptTarget.ES2020 });
const libSource = ts.sys.readFile(libPath) ?? "";

interface Probe {
  completions: string[];
  diagnostics: string[];
}

function probe(source: string): Probe {
  const files: Record<string, string> = {
    [DECLARATIONS_PATH]: declarations,
    [MODEL_PATH]: source,
    [libPath]: libSource,
  };

  // Anything not held in memory falls through to disk so the `/// <reference
  // lib="..." />` chain inside the standard library resolves; without it
  // `Promise` degrades to `any` and callbacks look implicitly typed.
  const readFile = (fileName: string): string | undefined =>
    files[fileName] ?? ts.sys.readFile(fileName);

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => [DECLARATIONS_PATH, MODEL_PATH],
    getScriptVersion: () => "1",
    getScriptSnapshot: (fileName) => {
      const contents = readFile(fileName);
      return contents === undefined ? undefined : ts.ScriptSnapshot.fromString(contents);
    },
    getCurrentDirectory: () => "/",
    getCompilationSettings: () => ({
      allowNonTsExtensions: true,
      allowJs: true,
      checkJs: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2020,
      allowSyntheticDefaultImports: true,
      noLib: false,
    }),
    getDefaultLibFileName: () => libPath,
    fileExists: (fileName) => files[fileName] !== undefined || ts.sys.fileExists(fileName),
    readFile,
    directoryExists: (directory) => directory === "/" || ts.sys.directoryExists(directory),
    getDirectories: (directory) => ts.sys.getDirectories(directory),
  };

  const service = ts.createLanguageService(host, ts.createDocumentRegistry());

  return {
    completions:
      service.getCompletionsAtPosition(MODEL_PATH, source.length, {})?.entries.map((entry) => entry.name) ??
      [],
    diagnostics: service
      .getSemanticDiagnostics(MODEL_PATH)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")),
  };
}

const IMPORT = "import xapi from 'xapi';\n";

describe("xapi completions without an import", () => {
  it("suggests the xapi roots", () => {
    const { completions } = probe("xapi.");

    expect(completions).toEqual(expect.arrayContaining(["Command", "Status", "Config", "Event"]));
  });

  it.each([
    ["xapi.Command.", ["Audio", "Bookings", "Dial", "UserInterface"]],
    ["xapi.Status.", ["Audio", "Standby", "SystemUnit"]],
    ["xapi.Config.", ["Audio", "UserInterface", "Video"]],
    ["xapi.Event.", ["Bookings", "UserInterface"]],
  ])("suggests schema paths for %s", (source, expected) => {
    expect(probe(source).completions).toEqual(expect.arrayContaining(expected));
  });

  it("resolves deep command paths", () => {
    expect(probe("xapi.Command.Audio.Volume.").completions).toEqual(
      expect.arrayContaining(["Set", "Mute", "Increase"]),
    );
  });

  it("offers get/on/off on statuses and get/set/on on configurations", () => {
    expect(probe("xapi.Status.Standby.State.").completions).toEqual(
      expect.arrayContaining(["get", "on", "off"]),
    );
    expect(probe("xapi.Config.Audio.DefaultVolume.").completions).toEqual(
      expect.arrayContaining(["get", "set", "on"]),
    );
  });

  it("allows numeric access into indexed nodes", () => {
    expect(probe("xapi.Status.Audio.Input.Connectors.Ethernet[1].").completions).toEqual(
      expect.arrayContaining(["Mute"]),
    );
  });
});

describe("xapi completions with an import", () => {
  it("still resolves every root", () => {
    expect(probe(`${IMPORT}xapi.Command.`).completions).toEqual(
      expect.arrayContaining(["Audio", "UserInterface"]),
    );
    expect(probe(`${IMPORT}xapi.Config.Audio.`).completions.length).toBeGreaterThan(0);
  });
});

describe("xapi type checking", () => {
  it("accepts a command invoked with arguments and an XML body", () => {
    const { diagnostics } = probe(
      `${IMPORT}xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'lights' }, '<Extensions/>');\n`,
    );

    expect(diagnostics).toEqual([]);
  });

  it("accepts the shipped sample macro patterns without an import", () => {
    const { diagnostics } = probe(
      [
        "xapi.Command.UserInterface.Message.Alert.Display({ Title: 'Hi', Text: 'There' });",
        "xapi.Event.UserInterface.Extensions.Panel.Clicked.on(event => { const id = event.PanelId; });",
        "xapi.Status.Standby.State.get().then(state => state);",
        "xapi.Config.Audio.DefaultVolume.set(50);",
        "",
      ].join("\n"),
    );

    expect(diagnostics).toEqual([]);
  });

  it("rejects a configuration written with the wrong value type", () => {
    const { diagnostics } = probe("xapi.Config.Audio.DefaultVolume.set('loud');\n");

    expect(diagnostics.join(" ")).toContain("not assignable");
  });
});
