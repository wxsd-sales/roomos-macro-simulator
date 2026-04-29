import type { MonacoEditorInstance } from "./modules/editor/monacoEditor.ts";
import { hydrateIcons, icon } from "./modules/icons.ts";
import type { IconName } from "./modules/icons.ts";
import { products } from "./modules/productHelper.ts";
import { createAppState, createDeviceActions } from "./modules/app/index.ts";
import { createDeviceInstance } from "./modules/devices/index.ts";
import { createDefaultDeviceFixture } from "./modules/fixtures/index.ts";
import { createDeviceRenderer } from "./modules/devices/surfaces/renderers/deviceRenderer.ts";
import { createXapiFacade } from "./modules/xapi/facade.ts";
import type { XapiFacade } from "./modules/xapi/facade.ts";
import { runMacros as executeMacros } from "./modules/runMacros.ts";
import type { AppFile, DevicePanel, DeviceState, LogLevel, LogSeverityLevel } from "./modules/types.ts";
import { sampleMacros } from "./samples/index.ts";
import packageJson from "../package.json";

type MonacoEditorModule = typeof import("./modules/editor/monacoEditor.ts");
type MonacoApi = MonacoEditorModule["monacoApi"];
type XapiIntellisenseModule = typeof import("./modules/editor/xapiIntellisense.ts");
type XapiSchemaBundle = Awaited<ReturnType<XapiIntellisenseModule["installXapiIntellisense"]>>;
type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const MOMENTUM_THEME_CLASS_BY_THEME: Record<ResolvedTheme, string> = {
  light: "mds-theme-stable-lightWebex",
  dark: "mds-theme-stable-darkWebex",
};
const THEME_ICON_BY_PREFERENCE: Record<ThemePreference, IconName> = {
  system: "laptop",
  light: "brightnessHigh",
  dark: "quietHoursPresence",
};

interface PointerResizeOptions {
  axis: "x" | "y";
  element: HTMLElement;
  onMove(delta: number): void;
}

interface LogMessageParts {
  source: string;
  body: string;
}

function queryRequired<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element;
}

function getEventTargetElement(event: Event): Element | null {
  return event.target instanceof Element ? event.target : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function readStoredThemePreference(): ThemePreference {
  try {
    const storedPreference = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(storedPreference) ? storedPreference : "system";
  } catch {
    return "system";
  }
}

function getSystemTheme(): ResolvedTheme {
  return themeMediaQuery.matches ? "dark" : "light";
}

function resolveThemePreference(preference = themePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

function getMonacoThemeName(): string {
  return resolveThemePreference() === "dark" ? "vs-dark" : "vs";
}

function updateMonacoTheme(): void {
  loadedMonacoApi?.editor.setTheme(getMonacoThemeName());
}

function loadMonacoEditorModule(): Promise<MonacoEditorModule> {
  if (!monacoEditorModuleReady) {
    monacoEditorModuleReady = import("./modules/editor/monacoEditor.ts").then((module) => {
      loadedMonacoApi = module.monacoApi;
      return module;
    });
  }

  return monacoEditorModuleReady;
}

function formatThemePreference(preference: ThemePreference): string {
  switch (preference) {
    case "system":
      return "System";
    case "light":
      return "Light";
    case "dark":
      return "Dark";
  }
}

function persistThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
      return;
    }

    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Theme persistence is a convenience; the active choice still applies for this page load.
  }
}

function setThemeSelectMenuOpen(open: boolean): void {
  els.themeSelectMenu.hidden = !open;
  els.themeSelectButton.setAttribute("aria-expanded", String(open));
}

function updateThemeSelect(): void {
  const resolvedTheme = resolveThemePreference();
  const preferenceLabel = formatThemePreference(themePreference);
  els.themeSelectLabel.textContent = preferenceLabel;
  els.themeSelectCurrentIcon.innerHTML = icon(THEME_ICON_BY_PREFERENCE[themePreference]);
  els.themeSelectButton.setAttribute(
    "aria-label",
    `Theme: ${preferenceLabel}. Active theme: ${resolvedTheme}. Open theme menu.`,
  );
  els.themeSelectButton.title = `Theme: ${preferenceLabel}`;
  els.themeSelectMenu.querySelectorAll<HTMLElement>("[data-theme-choice]").forEach((option) => {
    const selected = option.dataset.themeChoice === themePreference;
    option.setAttribute("aria-selected", String(selected));
    option.classList.toggle("selected", selected);
  });
}

function applyTheme(): void {
  const resolvedTheme = resolveThemePreference();
  document.documentElement.classList.toggle(
    MOMENTUM_THEME_CLASS_BY_THEME.light,
    resolvedTheme === "light",
  );
  document.documentElement.classList.toggle(
    MOMENTUM_THEME_CLASS_BY_THEME.dark,
    resolvedTheme === "dark",
  );
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = themePreference;
  document.documentElement.style.colorScheme = resolvedTheme;
  updateMonacoTheme();
  updateThemeSelect();
}

function setThemePreference(preference: ThemePreference): void {
  themePreference = preference;
  persistThemePreference(preference);
  applyTheme();
}

function getMajorVersionLabel(version: string): string {
  const majorVersion = version.trim().split(".")[0];
  return `v${majorVersion || version}`;
}

function initializeNavigatorFooter(): void {
  els.navigatorVersion.textContent = `RoomOS Macro Simulator ${getMajorVersionLabel(packageJson.version)}`;
}

const defaultDeviceFixture = createDefaultDeviceFixture();
const primaryDevice = createDeviceInstance({
  id: defaultDeviceFixture.id,
  productId: defaultDeviceFixture.productId,
  productName: defaultDeviceFixture.productName,
  mode: defaultDeviceFixture.mode,
  surfaces: defaultDeviceFixture.surfaces,
  initialState: defaultDeviceFixture.state,
});
const deviceRuntime = primaryDevice.runtime;

const state = createAppState({ device: deviceRuntime.getState() });

let monacoEditor: MonacoEditorInstance | null = null;
let monacoReady: Promise<MonacoEditorInstance> | null = null;
let monacoEditorModuleReady: Promise<MonacoEditorModule> | null = null;
let loadedMonacoApi: MonacoApi | null = null;
let isApplyingEditorState = false;
let activeResizeCleanup: (() => void) | null = null;
let activeEditorFileId: string | null = null;
let xapiSchemaBundle: XapiSchemaBundle | null = null;
let xapiSchemaReady: Promise<XapiSchemaBundle | null> | null = null;
let activeXapiFacade: XapiFacade | null = null;

const DESKTOP_LAYOUT_MEDIA_QUERY = "(min-width: 1160px)";
const HORIZONTAL_RESIZER_SIZE = 18;
const VERTICAL_RESIZER_SIZE = 18;
const PANEL_MIN_WIDTHS = {
  files: 220,
  editor: 360,
  simulator: 560,
};
const PANEL_DEFAULT_WIDTHS = {
  files: 280,
  simulator: 560,
};
const PANEL_MAX_WIDTHS = {
  files: 420,
};
const PANEL_MIN_HEIGHTS = {
  editor: 220,
  runtime: 160,
};
const PANEL_DEFAULT_HEIGHTS = {
  runtime: 280,
};
const THEME_STORAGE_KEY = "roomos-macro-simulator-theme";
const themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
let themePreference = readStoredThemePreference();

const els = {
  fileInput: queryRequired<HTMLInputElement>("#file-input"),
  fileList: queryRequired<HTMLElement>("#file-list"),
  macroSidebarToggleButton: queryRequired<HTMLButtonElement>("#macro-sidebar-toggle-button"),
  navigatorVersion: queryRequired<HTMLElement>("#navigator-version"),
  newFileButton: queryRequired<HTMLButtonElement>("#new-file-button"),
  loadSampleButton: queryRequired<HTMLButtonElement>("#load-sample-button"),
  runButton: queryRequired<HTMLButtonElement>("#run-button"),
  themeSelectShell: queryRequired<HTMLElement>("#theme-select-shell"),
  themeSelectButton: queryRequired<HTMLButtonElement>("#theme-select-button"),
  themeSelectCurrentIcon: queryRequired<HTMLElement>("#theme-select-current-icon"),
  themeSelectLabel: queryRequired<HTMLElement>("#theme-select-label"),
  themeSelectMenu: queryRequired<HTMLElement>("#theme-select-menu"),
  productSelect: queryRequired<HTMLSelectElement>("#product-select"),
  resetButton: queryRequired<HTMLButtonElement>("#reset-button"),
  logSeverityButton: queryRequired<HTMLButtonElement>("#log-severity-button"),
  logSeverityMenu: queryRequired<HTMLElement>("#log-severity-menu"),
  logFilterInput: queryRequired<HTMLInputElement>("#log-filter-input"),
  codeEditor: queryRequired<HTMLElement>("#code-editor"),
  editorSurface: queryRequired<HTMLElement>("#editor-surface"),
  editorPanel: queryRequired<HTMLElement>("#editor-panel"),
  workspace: queryRequired<HTMLElement>("#workspace"),
  filesPanel: queryRequired<HTMLElement>("#files-panel"),
  simulatorPanel: queryRequired<HTMLElement>("#simulator-panel"),
  deviceRenderRoot: queryRequired<HTMLElement>("#device-render-root"),
  runtimeConsole: queryRequired<HTMLElement>("#runtime-console"),
  filesEditorResizer: queryRequired<HTMLElement>("#files-editor-resizer"),
  editorSimulatorResizer: queryRequired<HTMLElement>("#editor-simulator-resizer"),
  editorConsoleResizer: queryRequired<HTMLElement>("#editor-console-resizer"),
  logOutput: queryRequired<HTMLElement>("#log-output"),
  helpOverlay: queryRequired<HTMLElement>("#help-overlay"),
  closeHelpButton: queryRequired<HTMLButtonElement>("#close-help-button"),
};

const layoutState = {
  desktopMq: window.matchMedia(DESKTOP_LAYOUT_MEDIA_QUERY),
  filesWidth: PANEL_DEFAULT_WIDTHS.files,
  simulatorWidth: PANEL_DEFAULT_WIDTHS.simulator,
  runtimeHeight: PANEL_DEFAULT_HEIGHTS.runtime,
};

const deviceRenderer = createDeviceRenderer({
  container: els.deviceRenderRoot,
  onDismissAlert: () => deviceActions.dismissAlert(),
  onSelectPanel: handleDevicePanelSelection,
});
const deviceActions = createDeviceActions({
  deviceRuntime,
  addLog,
  renderDevice,
  onDeviceChange: setActiveDeviceState,
});

const LOG_SEVERITY_LEVELS: LogSeverityLevel[] = ["error", "warn", "info", "log", "debug"];

function createFile(name: string, content = ""): AppFile {
  return {
    id: crypto.randomUUID(),
    name,
    content,
    deviceContent: content,
    enabled: true,
  };
}

function getActiveFile(): AppFile | null {
  return state.files.find((file) => file.id === state.activeFileId) ?? null;
}

function getFileById(fileId: string | null | undefined): AppFile | null {
  if (!fileId) {
    return null;
  }
  return state.files.find((file) => file.id === fileId) ?? null;
}

function normalizeLogLevel(level: string): LogLevel {
  if (level === "success" || isLogSeverityLevel(level)) {
    return level;
  }
  return "info";
}

function addLog(message: string, level = "info"): void {
  state.logs.unshift({
    id: crypto.randomUUID(),
    level: normalizeLogLevel(level),
    message,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  });
  renderLogs();
}

function getProductOptions(): string[] {
  return [...new Set(Object.values(products))].sort((a, b) => a.localeCompare(b));
}

function getSelectedProductId(): string | null {
  const selectedProductName = els.productSelect.value;
  return Object.entries(products).find(([, name]) => name === selectedProductName)?.[0] ?? null;
}

function initializeProductSelect(): void {
  const options = getProductOptions();
  els.productSelect.innerHTML = options
    .map(
      (name) =>
        `<option value="${escapeHtml(name)}"${name === primaryDevice.profile.productName ? " selected" : ""}>${escapeHtml(name)}</option>`,
    )
    .join("");
}

function isLogSeverityLevel(level: unknown): level is LogSeverityLevel {
  return typeof level === "string" && LOG_SEVERITY_LEVELS.includes(level as LogSeverityLevel);
}

function normalizeLogSeverity(level: LogLevel | string): LogSeverityLevel {
  if (level === "success") {
    return "info";
  }

  return isLogSeverityLevel(level) ? level : "log";
}

function formatLogSeverity(level: LogLevel | string): string {
  switch (normalizeLogSeverity(level)) {
    case "error":
      return "Error";
    case "warn":
      return "Warn";
    case "info":
      return "Info";
    case "debug":
      return "Debug";
    default:
      return "Log";
  }
}

function parseLogMessageParts(message: unknown): LogMessageParts {
  const normalized = String(message ?? "");
  const match = normalized.match(/^([^:]+):\s+(.*)$/);
  if (!match) {
    return {
      source: "Simulator",
      body: normalized,
    };
  }

  return {
    source: match[1],
    body: match[2],
  };
}

function closeLogSeverityMenu(): void {
  state.logSeverityMenuOpen = false;
  renderLogSeverityMenu();
}

function toggleLogSeverityMenu(): void {
  state.logSeverityMenuOpen = !state.logSeverityMenuOpen;
  renderLogSeverityMenu();
}

function resetLogSeverityFilters(): void {
  state.logSeverityLevels = new Set<LogSeverityLevel>(LOG_SEVERITY_LEVELS);
  renderLogSeverityMenu();
  renderLogs();
}

function toggleLogSeverityFilter(level: string | undefined): void {
  if (!isLogSeverityLevel(level)) {
    return;
  }
  const nextLevels = new Set(state.logSeverityLevels);
  if (nextLevels.has(level)) {
    nextLevels.delete(level);
  } else {
    nextLevels.add(level);
  }
  state.logSeverityLevels = nextLevels;
  renderLogSeverityMenu();
  renderLogs();
}

function renderLogSeverityMenu(): void {
  if (!els.logSeverityButton || !els.logSeverityMenu) {
    return;
  }

  els.logSeverityButton.setAttribute("aria-expanded", String(state.logSeverityMenuOpen));
  els.logSeverityMenu.hidden = !state.logSeverityMenuOpen;

  els.logSeverityMenu.querySelectorAll<HTMLElement>("[data-log-level]").forEach((item) => {
    const level = item.dataset.logLevel;
    const checked = isLogSeverityLevel(level) && state.logSeverityLevels.has(level);
    item.setAttribute("aria-checked", String(checked));
    item.classList.toggle("selected", checked);
  });
}

function getVisibleLogs() {
  const filterText = state.logFilterText.trim().toLowerCase();

  return state.logs.filter((log) => {
    const severity = normalizeLogSeverity(log.level);
    if (!state.logSeverityLevels.has(severity)) {
      return false;
    }

    if (!filterText) {
      return true;
    }

    const haystack = `${log.timestamp} ${formatLogSeverity(log.level)} ${log.message}`.toLowerCase();
    return haystack.includes(filterText);
  });
}

function getDisplayFileName(name: string): string {
  return name.replace(/\.(js|mjs|txt)$/i, "");
}

function isFileDirty(file: AppFile): boolean {
  return file.content !== file.deviceContent;
}

function closeFileMenu(): void {
  const openFileMenuId = state.openFileMenuId;
  if (openFileMenuId === null) {
    return;
  }
  state.openFileMenuId = null;
  updateFileListItemById(openFileMenuId);
  renderFloatingFileMenu();
}

function toggleFileEnabled(file: AppFile): void {
  file.enabled = !file.enabled;
  addLog(`${file.enabled ? "Enabled" : "Disabled"} ${file.name}`, "success");
  updateFileListItem(file);
}

function renameFile(file: AppFile): void {
  const nextName = window.prompt("Rename macro file", file.name);
  if (!nextName) {
    return;
  }

  file.name = nextName.trim() || file.name;
  state.openFileMenuId = null;
  render();
}

function removeFile(file: AppFile): void {
  state.files = state.files.filter((entry) => entry.id !== file.id);
  if (state.activeFileId === file.id) {
    state.activeFileId = state.files[0]?.id ?? null;
  }
  state.openFileMenuId = null;
  addLog(`Deleted ${file.name}`, "success");
  render();
}

function saveFileToDisk(file: AppFile): void {
  const blob = new Blob([file.content], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  state.openFileMenuId = null;
  addLog(`Saved ${file.name} to file.`, "success");
  updateFileListItem(file);
  renderFloatingFileMenu();
}

function saveFileToDevice(file: AppFile): void {
  file.deviceContent = file.content;
  addLog(`Saved ${file.name} to simulated device.`, "success");
  updateFileListItem(file);
}

function getOpenFileMenuButton(): HTMLElement | null {
  if (!state.openFileMenuId) {
    return null;
  }

  return document.querySelector<HTMLElement>(`.file-menu-button[data-file-id="${state.openFileMenuId}"]`);
}

function renderFloatingFileMenu(): void {
  const existingMenu = document.querySelector<HTMLElement>("#floating-file-menu");
  const openFile = state.files.find((file) => file.id === state.openFileMenuId);
  const anchorButton = getOpenFileMenuButton();

  if (!openFile || !anchorButton) {
    existingMenu?.remove();
    return;
  }

  const menu = existingMenu ?? document.createElement("div");
  menu.id = "floating-file-menu";
  menu.className = "file-menu file-menu-floating";
  menu.setAttribute("role", "menu");
  menu.innerHTML = `
    <button class="file-menu-item" type="button" data-action="save" role="menuitem">Save to File</button>
    <button class="file-menu-item" type="button" data-action="toggle" role="menuitem">${openFile.enabled ? "Disable" : "Enable"}</button>
    <div class="file-menu-divider"></div>
    <button class="file-menu-item" type="button" data-action="rename" role="menuitem">Rename</button>
    <button class="file-menu-item" type="button" data-action="delete" role="menuitem">Delete</button>
  `;

  if (!existingMenu) {
    document.body.append(menu);
  }

  menu.querySelectorAll<HTMLButtonElement>(".file-menu-item").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();

      switch (button.dataset.action) {
        case "save":
          saveFileToDisk(openFile);
          break;
        case "toggle":
          toggleFileEnabled(openFile);
          break;
        case "rename":
          renameFile(openFile);
          break;
        case "delete":
          removeFile(openFile);
          break;
        default:
          break;
      }
    });
  });

  menu.style.left = "0px";
  menu.style.top = "0px";
  menu.style.visibility = "hidden";

  requestAnimationFrame(() => {
    const anchorRect = anchorButton.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportPadding = 12;
    const preferredGap = 8;
    const spaceBelow = window.innerHeight - anchorRect.bottom - viewportPadding;
    const spaceAbove = anchorRect.top - viewportPadding;
    const opensDown = spaceBelow >= menuRect.height || spaceBelow >= spaceAbove;

    let top = opensDown
      ? anchorRect.bottom + preferredGap
      : anchorRect.top - menuRect.height - preferredGap;
    let left = anchorRect.right - menuRect.width;

    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - menuRect.height - viewportPadding));
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - menuRect.width - viewportPadding));

    menu.dataset.direction = opensDown ? "down" : "up";
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = "visible";
  });
}

function saveActiveFileToDeviceAndRestart(): void {
  const activeFile = getActiveFile();
  if (!activeFile) {
    addLog("No active macro selected.", "error");
    return;
  }

  if (isFileDirty(activeFile)) {
    saveFileToDevice(activeFile);
  } else {
    addLog(`${activeFile.name} is already saved to the simulated device.`, "info");
  }

  runMacros();
}

function exportActiveFile(): void {
  const activeFile = getActiveFile();
  if (!activeFile) {
    addLog("No active macro selected for export.", "error");
    return;
  }

  saveFileToDisk(activeFile);
}

function openFromFile(): void {
  els.fileInput.click();
}

function toggleHelp(): void {
  state.helpVisible = !state.helpVisible;
  renderVisibilityState();
}

function toggleLog(): void {
  state.logVisible = !state.logVisible;
  renderVisibilityState();
}

function toggleMacroSidebar(): void {
  state.macroSidebarVisible = !state.macroSidebarVisible;
  renderVisibilityState();
}

function renderVisibilityState(): void {
  els.helpOverlay.classList.toggle("hidden", !state.helpVisible);
  els.helpOverlay.setAttribute("aria-hidden", String(!state.helpVisible));
  els.runtimeConsole.classList.toggle("hidden-panel", !state.logVisible);
  els.editorConsoleResizer.classList.toggle("hidden-panel", !state.logVisible);
  els.filesPanel.classList.toggle("hidden-panel", !state.macroSidebarVisible);
  els.filesEditorResizer.classList.toggle("hidden-panel", !state.macroSidebarVisible || !isDesktopLayout());
  els.workspace.classList.toggle("macro-sidebar-hidden", !state.macroSidebarVisible);
  els.macroSidebarToggleButton.setAttribute("aria-pressed", String(state.macroSidebarVisible));
  els.macroSidebarToggleButton.title = state.macroSidebarVisible ? "Hide macros panel" : "Show macros panel";
  applyWorkspaceLayout();
  applyEditorLayout();
}

function getFileItemMarkup(file: AppFile): string {
  return `
    <div class="file-item ${file.id === state.activeFileId ? "active" : ""}" data-file-id="${file.id}">
      <strong class="file-name">${escapeHtml(getDisplayFileName(file.name))}</strong>
      ${
        isFileDirty(file)
          ? `
            <button class="file-save-button" type="button" aria-label="Save ${escapeHtml(file.name)} to simulated device">
              ${icon("save")}
            </button>
          `
          : ""
      }
      <button
        class="file-menu-button"
        type="button"
        data-file-id="${file.id}"
        aria-haspopup="menu"
        aria-expanded="${file.id === state.openFileMenuId ? "true" : "false"}"
        aria-label="File actions for ${escapeHtml(file.name)}"
      >
        ${icon("tools")}
      </button>
      <input class="file-toggle" type="checkbox" ${file.enabled ? "checked" : ""} aria-label="${file.enabled ? "Disable" : "Enable"} ${file.name}" />
    </div>
  `;
}

function updateFileListItem(file: AppFile): void {
  const item = els.fileList.querySelector(`.file-item[data-file-id="${file.id}"]`);
  if (!item) {
    return;
  }

  item.outerHTML = getFileItemMarkup(file);

  if (state.openFileMenuId === file.id) {
    renderFloatingFileMenu();
  }
}

function updateFileListItemById(fileId: string | null | undefined): void {
  const file = getFileById(fileId);
  if (file) {
    updateFileListItem(file);
    return;
  }

  renderFiles();
}

function renderFiles(): void {
  if (!state.files.length) {
    els.fileList.innerHTML = `
      <div class="file-item">
        <strong class="file-name">No macros yet</strong>
        <div></div>
        <div></div>
      </div>
    `;
    renderFloatingFileMenu();
    return;
  }

  els.fileList.innerHTML = state.files.map(getFileItemMarkup).join("");

  renderFloatingFileMenu();
}

function renderEditor(): void {
  const activeFile = getActiveFile();

  if (!monacoEditor) {
    return;
  }

  const nextEditorFileId = activeFile?.id ?? null;
  const nextEditorValue = activeFile?.content ?? "";
  const shouldSyncEditorValue =
    activeEditorFileId !== nextEditorFileId ||
    monacoEditor.getValue() !== nextEditorValue;

  isApplyingEditorState = true;
  monacoEditor.updateOptions({ readOnly: !activeFile });
  if (shouldSyncEditorValue) {
    monacoEditor.setValue(nextEditorValue);
  }
  isApplyingEditorState = false;
  activeEditorFileId = nextEditorFileId;

  // Monaco can fail to repaint correctly after panel/header layout changes unless
  // we explicitly ask it to recalculate its dimensions on the next frame.
  requestAnimationFrame(() => {
    monacoEditor?.layout();
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isDesktopLayout(): boolean {
  return layoutState.desktopMq.matches;
}

function getWorkspaceAvailableWidth(): number {
  const hasFilesPanel = state.macroSidebarVisible;
  const activeResizers = hasFilesPanel ? 2 : 1;
  return Math.max(
    0,
    els.workspace.clientWidth - (activeResizers * HORIZONTAL_RESIZER_SIZE),
  );
}

function getEditorPanelAvailableHeight(): number {
  const header = els.editorPanel.querySelector<HTMLElement>(".panel-header");
  const headerHeight = header?.offsetHeight ?? 0;
  return Math.max(0, els.editorPanel.clientHeight - headerHeight);
}

function getClampedHorizontalWidths(): { filesWidth: number; simulatorWidth: number; editorWidth: number } {
  const availableWidth = getWorkspaceAvailableWidth();
  if (!state.macroSidebarVisible) {
    const maxSimulatorWidth = Math.max(PANEL_MIN_WIDTHS.simulator, availableWidth - PANEL_MIN_WIDTHS.editor);
    const simulatorWidth = clamp(layoutState.simulatorWidth, PANEL_MIN_WIDTHS.simulator, maxSimulatorWidth);
    return {
      filesWidth: 0,
      simulatorWidth,
      editorWidth: Math.max(PANEL_MIN_WIDTHS.editor, availableWidth - simulatorWidth),
    };
  }

  const filesMax = Math.max(
    PANEL_MIN_WIDTHS.files,
    Math.min(
      PANEL_MAX_WIDTHS.files,
      availableWidth - PANEL_MIN_WIDTHS.editor - PANEL_MIN_WIDTHS.simulator,
    ),
  );
  const filesWidth = clamp(layoutState.filesWidth, PANEL_MIN_WIDTHS.files, filesMax);
  const simulatorMax = Math.max(
    PANEL_MIN_WIDTHS.simulator,
    availableWidth - filesWidth - PANEL_MIN_WIDTHS.editor,
  );
  const simulatorWidth = clamp(layoutState.simulatorWidth, PANEL_MIN_WIDTHS.simulator, simulatorMax);
  const editorWidth = availableWidth - filesWidth - simulatorWidth;

  return {
    filesWidth,
    simulatorWidth,
    editorWidth,
  };
}

function getClampedRuntimeHeight(): number {
  if (!state.logVisible) {
    return 0;
  }

  const availableHeight = getEditorPanelAvailableHeight();
  const maxRuntimeHeight = Math.max(
    PANEL_MIN_HEIGHTS.runtime,
    availableHeight - VERTICAL_RESIZER_SIZE - PANEL_MIN_HEIGHTS.editor,
  );

  return clamp(layoutState.runtimeHeight, PANEL_MIN_HEIGHTS.runtime, maxRuntimeHeight);
}

function applyWorkspaceLayout(): void {
  if (!isDesktopLayout()) {
    els.workspace.style.gridTemplateColumns = "";
    els.filesEditorResizer.classList.add("hidden-panel");
    els.editorSimulatorResizer.classList.add("hidden-panel");
    els.filesEditorResizer.style.display = "none";
    els.editorSimulatorResizer.style.display = "none";
    els.workspace.classList.toggle("macro-sidebar-hidden", !state.macroSidebarVisible);
    return;
  }

  const { filesWidth, simulatorWidth, editorWidth } = getClampedHorizontalWidths();
  layoutState.filesWidth = filesWidth || layoutState.filesWidth;
  layoutState.simulatorWidth = simulatorWidth;

  els.filesEditorResizer.classList.toggle("hidden-panel", !state.macroSidebarVisible);
  els.editorSimulatorResizer.classList.remove("hidden-panel");
  els.filesEditorResizer.style.display = state.macroSidebarVisible ? "" : "none";
  els.editorSimulatorResizer.style.display = "";

  if (state.macroSidebarVisible) {
    els.workspace.style.gridTemplateColumns = `${filesWidth}px ${HORIZONTAL_RESIZER_SIZE}px ${editorWidth}px ${HORIZONTAL_RESIZER_SIZE}px ${simulatorWidth}px`;
  } else {
    els.workspace.style.gridTemplateColumns = `${editorWidth}px ${HORIZONTAL_RESIZER_SIZE}px ${simulatorWidth}px`;
  }
}

function applyEditorLayout(): void {
  if (!state.logVisible) {
    els.editorSurface.style.height = "";
    els.editorSurface.style.flex = "1 1 auto";
    els.runtimeConsole.style.height = "";
    requestAnimationFrame(() => {
      monacoEditor?.layout();
    });
    return;
  }

  const availableHeight = getEditorPanelAvailableHeight();
  const runtimeHeight = getClampedRuntimeHeight();
  const editorHeight = Math.max(
    PANEL_MIN_HEIGHTS.editor,
    availableHeight - VERTICAL_RESIZER_SIZE - runtimeHeight,
  );

  layoutState.runtimeHeight = runtimeHeight;
  els.editorSurface.style.flex = "0 0 auto";
  els.editorSurface.style.height = `${editorHeight}px`;
  els.runtimeConsole.style.height = `${runtimeHeight}px`;

  requestAnimationFrame(() => {
    monacoEditor?.layout();
  });
}

function updateLayout(): void {
  applyWorkspaceLayout();
  applyEditorLayout();
  if (state.openFileMenuId) {
    renderFloatingFileMenu();
  }
}

function startPointerResize(event: PointerEvent, { axis, element, onMove }: PointerResizeOptions): void {
  if (event.button !== 0) {
    return;
  }

  activeResizeCleanup?.();
  event.preventDefault();
  document.body.classList.add("is-resizing");
  element.classList.add("dragging");

  const moveHandler = (moveEvent: PointerEvent) => {
    const delta = axis === "x" ? moveEvent.clientX - event.clientX : moveEvent.clientY - event.clientY;
    onMove(delta);
  };

  const cleanup = () => {
    document.body.classList.remove("is-resizing");
    element.classList.remove("dragging");
    window.removeEventListener("pointermove", moveHandler);
    window.removeEventListener("pointerup", cleanup);
    window.removeEventListener("pointercancel", cleanup);
    activeResizeCleanup = null;
  };

  activeResizeCleanup = cleanup;
  window.addEventListener("pointermove", moveHandler);
  window.addEventListener("pointerup", cleanup);
  window.addEventListener("pointercancel", cleanup);
}

function initializeResizablePanels(): void {
  els.filesEditorResizer.addEventListener("pointerdown", (event) => {
    if (!isDesktopLayout() || !state.macroSidebarVisible) {
      return;
    }

    const startFilesWidth = getClampedHorizontalWidths().filesWidth;
    startPointerResize(event, {
      axis: "x",
      element: els.filesEditorResizer,
      onMove: (delta: number) => {
        layoutState.filesWidth = startFilesWidth + delta;
        applyWorkspaceLayout();
      },
    });
  });

  els.editorSimulatorResizer.addEventListener("pointerdown", (event) => {
    if (!isDesktopLayout()) {
      return;
    }

    const startSimulatorWidth = getClampedHorizontalWidths().simulatorWidth;
    startPointerResize(event, {
      axis: "x",
      element: els.editorSimulatorResizer,
      onMove: (delta: number) => {
        layoutState.simulatorWidth = startSimulatorWidth - delta;
        applyWorkspaceLayout();
      },
    });
  });

  els.editorConsoleResizer.addEventListener("pointerdown", (event) => {
    if (!state.logVisible) {
      return;
    }

    const startRuntimeHeight = getClampedRuntimeHeight();
    startPointerResize(event, {
      axis: "y",
      element: els.editorConsoleResizer,
      onMove: (delta: number) => {
        layoutState.runtimeHeight = startRuntimeHeight - delta;
        applyEditorLayout();
      },
    });
  });

  layoutState.desktopMq.addEventListener("change", updateLayout);
}

function renderLogs(): void {
  els.logOutput.innerHTML = "";
  renderLogSeverityMenu();

  const visibleLogs = getVisibleLogs();

  if (!visibleLogs.length) {
    const idle = document.createElement("div");
    idle.className = "log-empty-state";
    idle.textContent = state.logs.length
      ? "No log entries match the current filters."
      : "Macro activity will appear here.";
    els.logOutput.append(idle);
    return;
  }

  visibleLogs.forEach((log) => {
    const parts = parseLogMessageParts(log.message);
    const row = document.createElement("div");
    row.className = `log-line ${normalizeLogSeverity(log.level)} ${log.level === "success" ? "success" : ""}`;
    row.innerHTML = `
      <span class="log-time">${escapeHtml(log.timestamp)}</span>
      <span class="log-source">${escapeHtml(parts.source)}</span>
      <span class="log-chevron" aria-hidden="true">&#8250;</span>
      <span class="log-severity">[${escapeHtml(formatLogSeverity(log.level).toLowerCase())}]</span>
      <span class="log-message">${escapeHtml(parts.body)}</span>
    `;
    els.logOutput.append(row);
  });
}

function setActiveDeviceState(device: DeviceState): DeviceState {
  state.device = device;
  return state.device;
}

function getExtensionPanelById(panelId: string): DevicePanel | null {
  const device = deviceRuntime.getState();
  return device.panels.find((panel) => panel.id === panelId || panel.name === panelId) ?? null;
}

function emitPanelClicked(panelId: string): void {
  const panel = getExtensionPanelById(panelId);
  if (!panel || !activeXapiFacade) {
    return;
  }

  activeXapiFacade.command("UserInterface.Extensions.Panel.Clicked", {
    PanelId: panel.id,
    Origin: "local",
    PeripheralId: "simulator",
  }).catch((error: unknown) => {
    addLog(`Failed to emit panel clicked event: ${getErrorMessage(error)}`, "error");
  });
}

function handleDevicePanelSelection(panelId: string): void {
  deviceActions.selectPanel(panelId);
  emitPanelClicked(panelId);
}

function renderDevice(): void {
  deviceRenderer.render(setActiveDeviceState(deviceRuntime.getState()));
}

function render(): void {
  renderFiles();
  renderEditor();
  renderLogs();
  renderDevice();
  renderVisibilityState();
}

function escapeHtml(text: unknown): string {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function runMacros(): Promise<void> {
  if (xapiSchemaReady && !xapiSchemaBundle) {
    await xapiSchemaReady;
  }

  activeXapiFacade = null;
  setActiveDeviceState(deviceRuntime.reset());
  renderDevice();
  await executeMacros({
    files: state.files,
    addLog,
    createXapiFacade: () => {
      activeXapiFacade = createXapiFacade({
        device: deviceRuntime.getState(),
        addLog,
        renderDevice,
        schemaBundle: xapiSchemaBundle,
        productId: getSelectedProductId(),
        productName: els.productSelect.value,
      });
      return activeXapiFacade;
    },
  });
}

function createNewFile(): void {
  const name = `macro-${state.files.length + 1}.js`;
  const file = createFile(
    name,
    `import xapi from 'xapi';\n\n// Start building your RoomOS macro here.\n`,
  );
  state.files.unshift(file);
  state.activeFileId = file.id;
  render();
}

function loadSampleMacro(): void {
  try {
    const imported = sampleMacros.map((sample) => {
      const file = createFile(sample.name, sample.content);
      file.enabled = sample.enabled;
      return file;
    });

    state.files = [...imported, ...state.files];
    state.activeFileId = imported[0]?.id ?? state.activeFileId;
    addLog(`Loaded ${imported.length} sample macro${imported.length === 1 ? "" : "s"} into workspace.`, "success");
    render();
  } catch (error) {
    addLog(`Failed to load sample macros: ${getErrorMessage(error)}`, "error");
  }
}

async function handleFileUpload(event: Event): Promise<void> {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const files = Array.from(input?.files ?? []);
  if (!files.length) {
    return;
  }

  const imported = await Promise.all(
    files.map(async (file) => createFile(file.name, await file.text())),
  );

  state.files = [...imported, ...state.files];
  state.activeFileId = imported[0].id;
  addLog(`Imported ${imported.length} macro file${imported.length === 1 ? "" : "s"}.`, "success");
  render();
  if (input) {
    input.value = "";
  }
}

function initializeMonaco(): Promise<MonacoEditorInstance> {
  if (monacoReady) {
    return monacoReady;
  }

  monacoReady = (async () => {
    const [{ initializeMonacoEditor, monacoApi }, { installXapiIntellisense }] = await Promise.all([
      loadMonacoEditorModule(),
      import("./modules/editor/xapiIntellisense.ts"),
    ]);
    const editor = await initializeMonacoEditor({
      container: els.codeEditor,
      theme: getMonacoThemeName(),
      onChange: () => {
        if (isApplyingEditorState) {
          return;
        }

        const activeFile = getActiveFile();
        if (!activeFile || !monacoEditor) {
          return;
        }

        activeFile.content = monacoEditor.getValue();
        updateFileListItem(activeFile);
      },
      onBlur: () => {
        const activeFile = getActiveFile();
        if (activeFile) {
          updateFileListItem(activeFile);
        }
      },
    });

    monacoEditor = editor;
    updateMonacoTheme();
    renderEditor();
    xapiSchemaReady = installXapiIntellisense({
      monaco: monacoApi,
      addLog,
    })
      .then((schemaBundle) => {
        xapiSchemaBundle = schemaBundle;
        return schemaBundle;
      })
      .catch((error: unknown) => {
        addLog(`Failed to load xapi schema: ${getErrorMessage(error)}`, "error");
        return null;
      });
    return editor;
  })();

  return monacoReady;
}

function handleGlobalShortcuts(event: KeyboardEvent): void {
  const metaKeyPressed = event.metaKey || event.ctrlKey;
  if (!metaKeyPressed) {
    if (event.key === "Escape" && !els.themeSelectMenu.hidden) {
      setThemeSelectMenuOpen(false);
      els.themeSelectButton.focus();
      return;
    }

    if (event.key === "Escape" && state.helpVisible) {
      state.helpVisible = false;
      renderVisibilityState();
    }
    return;
  }

  const key = event.key.toLowerCase();

  if ((key === "s" && !event.shiftKey) || (key === "enter" && !event.shiftKey)) {
    event.preventDefault();
    saveActiveFileToDeviceAndRestart();
    return;
  }

  if (key === "e" && !event.shiftKey) {
    event.preventDefault();
    exportActiveFile();
    return;
  }

  if (key === "o" && !event.shiftKey) {
    event.preventDefault();
    openFromFile();
    return;
  }

  if (event.shiftKey && key === "n") {
    event.preventDefault();
    createNewFile();
    return;
  }

  if (event.shiftKey && key === "h") {
    event.preventDefault();
    toggleHelp();
    return;
  }

  if (event.shiftKey && key === "g") {
    event.preventDefault();
    toggleLog();
    return;
  }

  if (event.shiftKey && key === "m") {
    event.preventDefault();
    toggleMacroSidebar();
  }
}

function resetSimulator(): void {
  activeXapiFacade = null;
  deviceActions.reset();
}

els.fileInput.addEventListener("change", handleFileUpload);
hydrateIcons();
initializeNavigatorFooter();
initializeProductSelect();
applyTheme();
els.newFileButton.addEventListener("click", createNewFile);
els.loadSampleButton.addEventListener("click", loadSampleMacro);
els.runButton.addEventListener("click", runMacros);
els.resetButton.addEventListener("click", resetSimulator);
els.macroSidebarToggleButton.addEventListener("click", toggleMacroSidebar);
els.themeSelectButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setThemeSelectMenuOpen(els.themeSelectMenu.hidden === true);
});
els.themeSelectMenu.addEventListener("click", (event) => {
  const target = getEventTargetElement(event);
  const option = target?.closest<HTMLElement>("[data-theme-choice]");
  const preference = option?.dataset.themeChoice ?? null;
  if (!isThemePreference(preference)) {
    return;
  }

  setThemePreference(preference);
  setThemeSelectMenuOpen(false);
});
els.logSeverityButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleLogSeverityMenu();
});
els.logSeverityMenu.addEventListener("click", (event) => {
  const target = getEventTargetElement(event);
  const resetButton = target?.closest("[data-log-level-reset]");
  if (resetButton) {
    resetLogSeverityFilters();
    closeLogSeverityMenu();
    return;
  }

  const item = target?.closest<HTMLElement>("[data-log-level]");
  if (!item) {
    return;
  }

  toggleLogSeverityFilter(item.dataset.logLevel);
});
els.fileList.addEventListener("click", (event) => {
  const target = getEventTargetElement(event);
  if (!target || target.closest(".file-toggle")) {
    return;
  }

  const saveButton = target.closest<HTMLElement>(".file-save-button");
  if (saveButton) {
    const item = saveButton.closest<HTMLElement>(".file-item[data-file-id]");
    const file = getFileById(item?.dataset.fileId);
    if (file) {
      saveFileToDevice(file);
    }
    return;
  }

  const menuButton = target.closest<HTMLElement>(".file-menu-button");
  if (menuButton) {
    const fileId = menuButton.dataset.fileId;
    if (!fileId) {
      return;
    }
    const previousOpenFileMenuId = state.openFileMenuId;
    state.openFileMenuId = previousOpenFileMenuId === fileId ? null : fileId;
    if (previousOpenFileMenuId) {
      updateFileListItemById(previousOpenFileMenuId);
    }
    if (state.openFileMenuId) {
      updateFileListItemById(state.openFileMenuId);
    } else {
      renderFloatingFileMenu();
    }
    return;
  }

  const item = target.closest<HTMLElement>(".file-item[data-file-id]");
  if (!item) {
    return;
  }

  const nextActiveFileId = item.dataset.fileId;
  if (!nextActiveFileId) {
    return;
  }
  const previousActiveFileId = state.activeFileId;
  const previousOpenFileMenuId = state.openFileMenuId;

  state.activeFileId = nextActiveFileId;
  state.openFileMenuId = null;

  if (previousActiveFileId && previousActiveFileId !== nextActiveFileId) {
    updateFileListItemById(previousActiveFileId);
  }
  updateFileListItemById(nextActiveFileId);
  if (previousOpenFileMenuId) {
    renderFloatingFileMenu();
  }
  renderEditor();
});
els.fileList.addEventListener("change", (event) => {
  const target = getEventTargetElement(event);
  const toggle = target?.closest<HTMLInputElement>(".file-toggle");
  if (!toggle) {
    return;
  }

  const item = toggle.closest<HTMLElement>(".file-item[data-file-id]");
  const file = getFileById(item?.dataset.fileId);
  if (file) {
    toggleFileEnabled(file);
  }
});
els.logFilterInput.addEventListener("input", (event) => {
  state.logFilterText = event.currentTarget instanceof HTMLInputElement
    ? event.currentTarget.value
    : els.logFilterInput.value;
  renderLogs();
});
els.closeHelpButton.addEventListener("click", toggleHelp);

document.addEventListener("click", (event) => {
  const target = getEventTargetElement(event);
  if (!target) {
    return;
  }

  if (!target.closest(".file-item") && !target.closest("#floating-file-menu")) {
    closeFileMenu();
  }

  if (!target.closest(".severity-menu-shell")) {
    closeLogSeverityMenu();
  }

  if (!target.closest("#theme-select-shell")) {
    setThemeSelectMenuOpen(false);
  }
});
document.addEventListener("keydown", handleGlobalShortcuts);
window.addEventListener("resize", () => {
  updateLayout();
});
themeMediaQuery.addEventListener("change", () => {
  if (themePreference === "system") {
    applyTheme();
  }
});
els.fileList.addEventListener("scroll", () => {
  if (state.openFileMenuId) {
    renderFloatingFileMenu();
  }
});

initializeResizablePanels();
loadSampleMacro();
render();
initializeMonaco().catch((error) => {
  addLog(`Failed to initialize Monaco Editor: ${error.message}`, "error");
});
