import { initializeMonacoEditor } from "./modules/monacoEditor.js";
import { hydrateIcons, icon } from "./modules/icons.js";
import { products } from "./modules/productHelper.js";
import { createDeviceRenderer } from "./modules/renderers/deviceRenderer.js";
import { createXapiFacade } from "./modules/xapiFacade.js";
import { runMacros as executeMacros } from "./modules/runMacros.js";
import { installXapiIntellisense } from "./modules/xapiIntellisense.js";

const state = {
  files: [],
  activeFileId: null,
  openFileMenuId: null,
  helpVisible: false,
  logVisible: true,
  macroSidebarVisible: true,
  logs: [],
  logFilterText: "",
  logSeverityMenuOpen: false,
  logSeverityLevels: new Set(["error", "warn", "info", "log", "debug"]),
  device: createDefaultDeviceState(),
};

let monacoEditor = null;
let monacoReady = null;
let isApplyingEditorState = false;
let activeResizeCleanup = null;
let activeEditorFileId = null;

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

const els = {
  fileInput: document.querySelector("#file-input"),
  fileList: document.querySelector("#file-list"),
  newFileButton: document.querySelector("#new-file-button"),
  loadSampleButton: document.querySelector("#load-sample-button"),
  runButton: document.querySelector("#run-button"),
  productSelect: document.querySelector("#product-select"),
  resetButton: document.querySelector("#reset-button"),
  logSeverityButton: document.querySelector("#log-severity-button"),
  logSeverityMenu: document.querySelector("#log-severity-menu"),
  logFilterInput: document.querySelector("#log-filter-input"),
  codeEditor: document.querySelector("#code-editor"),
  editorSurface: document.querySelector("#editor-surface"),
  editorPanel: document.querySelector("#editor-panel"),
  workspace: document.querySelector("#workspace"),
  filesPanel: document.querySelector("#files-panel"),
  simulatorPanel: document.querySelector("#simulator-panel"),
  deviceRenderRoot: document.querySelector("#device-render-root"),
  runtimeConsole: document.querySelector("#runtime-console"),
  filesEditorResizer: document.querySelector("#files-editor-resizer"),
  editorSimulatorResizer: document.querySelector("#editor-simulator-resizer"),
  editorConsoleResizer: document.querySelector("#editor-console-resizer"),
  logOutput: document.querySelector("#log-output"),
  helpOverlay: document.querySelector("#help-overlay"),
  closeHelpButton: document.querySelector("#close-help-button"),
};

const layoutState = {
  desktopMq: window.matchMedia(DESKTOP_LAYOUT_MEDIA_QUERY),
  filesWidth: PANEL_DEFAULT_WIDTHS.files,
  simulatorWidth: PANEL_DEFAULT_WIDTHS.simulator,
  runtimeHeight: PANEL_DEFAULT_HEIGHTS.runtime,
};

const deviceRenderer = createDeviceRenderer({
  container: els.deviceRenderRoot,
  onDismissAlert: () => {
    state.device.alert = null;
    addLog("Dismissed active alert.", "success");
    renderDevice();
  },
  onSelectPanel: (panel) => {
    state.device.activePanel = panel;
    addLog(`Switched visible device surface to ${state.device.activePanel}.`, "success");
    renderDevice();
  },
});

const LOG_SEVERITY_LEVELS = ["error", "warn", "info", "log", "debug"];

function createDefaultDeviceState() {
  return {
    alert: null,
    panels: [],
    activePanel: "Home",
    workspaceName: "Workspace Name",
    scheduler: {
      busy: false,
      title: "Focus Room 3A",
      subtitle: "No active booking",
      nextMeeting: "Not scheduled",
      presenter: "Awaiting macro input",
      progress: 0,
    },
  };
}

function createFile(name, content = "") {
  return {
    id: crypto.randomUUID(),
    name,
    content,
    deviceContent: content,
    enabled: true,
  };
}

function getActiveFile() {
  return state.files.find((file) => file.id === state.activeFileId) ?? null;
}

function getFileById(fileId) {
  return state.files.find((file) => file.id === fileId) ?? null;
}

function addLog(message, level = "info") {
  state.logs.unshift({
    id: crypto.randomUUID(),
    level,
    message,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  });
  renderLogs();
}

function getProductOptions() {
  return [...new Set(Object.values(products))].sort((a, b) => a.localeCompare(b));
}

function initializeProductSelect() {
  const options = getProductOptions();
  els.productSelect.innerHTML = options
    .map((name) => `<option value="${escapeHtml(name)}"${name === "Desk Pro" ? " selected" : ""}>${escapeHtml(name)}</option>`)
    .join("");
}

function normalizeLogSeverity(level) {
  if (level === "success") {
    return "info";
  }

  return LOG_SEVERITY_LEVELS.includes(level) ? level : "log";
}

function formatLogSeverity(level) {
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

function parseLogMessageParts(message) {
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

function closeLogSeverityMenu() {
  state.logSeverityMenuOpen = false;
  renderLogSeverityMenu();
}

function toggleLogSeverityMenu() {
  state.logSeverityMenuOpen = !state.logSeverityMenuOpen;
  renderLogSeverityMenu();
}

function resetLogSeverityFilters() {
  state.logSeverityLevels = new Set(LOG_SEVERITY_LEVELS);
  renderLogSeverityMenu();
  renderLogs();
}

function toggleLogSeverityFilter(level) {
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

function renderLogSeverityMenu() {
  if (!els.logSeverityButton || !els.logSeverityMenu) {
    return;
  }

  els.logSeverityButton.setAttribute("aria-expanded", String(state.logSeverityMenuOpen));
  els.logSeverityMenu.hidden = !state.logSeverityMenuOpen;

  els.logSeverityMenu.querySelectorAll("[data-log-level]").forEach((item) => {
    const level = item.dataset.logLevel;
    const checked = state.logSeverityLevels.has(level);
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

function getDisplayFileName(name) {
  return name.replace(/\.(js|mjs|txt)$/i, "");
}

function isFileDirty(file) {
  return file.content !== file.deviceContent;
}

function closeFileMenu() {
  const openFileMenuId = state.openFileMenuId;
  if (openFileMenuId === null) {
    return;
  }
  state.openFileMenuId = null;
  updateFileListItemById(openFileMenuId);
  renderFloatingFileMenu();
}

function toggleFileEnabled(file) {
  file.enabled = !file.enabled;
  addLog(`${file.enabled ? "Enabled" : "Disabled"} ${file.name}`, "success");
  updateFileListItem(file);
}

function renameFile(file) {
  const nextName = window.prompt("Rename macro file", file.name);
  if (!nextName) {
    return;
  }

  file.name = nextName.trim() || file.name;
  state.openFileMenuId = null;
  render();
}

function removeFile(file) {
  state.files = state.files.filter((entry) => entry.id !== file.id);
  if (state.activeFileId === file.id) {
    state.activeFileId = state.files[0]?.id ?? null;
  }
  state.openFileMenuId = null;
  addLog(`Deleted ${file.name}`, "success");
  render();
}

function saveFileToDisk(file) {
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

function saveFileToDevice(file) {
  file.deviceContent = file.content;
  addLog(`Saved ${file.name} to simulated device.`, "success");
  updateFileListItem(file);
}

function getOpenFileMenuButton() {
  if (!state.openFileMenuId) {
    return null;
  }

  return document.querySelector(`.file-menu-button[data-file-id="${state.openFileMenuId}"]`);
}

function renderFloatingFileMenu() {
  const existingMenu = document.querySelector("#floating-file-menu");
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

  menu.querySelectorAll(".file-menu-item").forEach((button) => {
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

function saveActiveFileToDeviceAndRestart() {
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

function exportActiveFile() {
  const activeFile = getActiveFile();
  if (!activeFile) {
    addLog("No active macro selected for export.", "error");
    return;
  }

  saveFileToDisk(activeFile);
}

function openFromFile() {
  els.fileInput.click();
}

function toggleHelp() {
  state.helpVisible = !state.helpVisible;
  renderVisibilityState();
}

function toggleLog() {
  state.logVisible = !state.logVisible;
  renderVisibilityState();
}

function toggleMacroSidebar() {
  state.macroSidebarVisible = !state.macroSidebarVisible;
  renderVisibilityState();
}

function renderVisibilityState() {
  els.helpOverlay.classList.toggle("hidden", !state.helpVisible);
  els.helpOverlay.setAttribute("aria-hidden", String(!state.helpVisible));
  els.runtimeConsole.classList.toggle("hidden-panel", !state.logVisible);
  els.editorConsoleResizer.classList.toggle("hidden-panel", !state.logVisible);
  els.filesPanel.classList.toggle("hidden-panel", !state.macroSidebarVisible);
  els.filesEditorResizer.classList.toggle("hidden-panel", !state.macroSidebarVisible || !isDesktopLayout());
  els.workspace.classList.toggle("macro-sidebar-hidden", !state.macroSidebarVisible);
  applyWorkspaceLayout();
  applyEditorLayout();
}

function getFileItemMarkup(file) {
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
          : '<div class="file-save-spacer"></div>'
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

function updateFileListItem(file) {
  const item = els.fileList.querySelector(`.file-item[data-file-id="${file.id}"]`);
  if (!item) {
    return;
  }

  item.outerHTML = getFileItemMarkup(file);

  if (state.openFileMenuId === file.id) {
    renderFloatingFileMenu();
  }
}

function updateFileListItemById(fileId) {
  const file = getFileById(fileId);
  if (file) {
    updateFileListItem(file);
    return;
  }

  renderFiles();
}

function renderFiles() {
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

function renderEditor() {
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isDesktopLayout() {
  return layoutState.desktopMq.matches;
}

function getWorkspaceAvailableWidth() {
  const hasFilesPanel = state.macroSidebarVisible;
  const activeResizers = hasFilesPanel ? 2 : 1;
  return Math.max(
    0,
    els.workspace.clientWidth - (activeResizers * HORIZONTAL_RESIZER_SIZE),
  );
}

function getEditorPanelAvailableHeight() {
  const header = els.editorPanel.querySelector(".panel-header");
  const headerHeight = header?.offsetHeight ?? 0;
  return Math.max(0, els.editorPanel.clientHeight - headerHeight);
}

function getClampedHorizontalWidths() {
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

function getClampedRuntimeHeight() {
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

function applyWorkspaceLayout() {
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

function applyEditorLayout() {
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

function updateLayout() {
  applyWorkspaceLayout();
  applyEditorLayout();
  if (state.openFileMenuId) {
    renderFloatingFileMenu();
  }
}

function startPointerResize(event, { axis, element, onMove }) {
  if (event.button !== 0) {
    return;
  }

  activeResizeCleanup?.();
  event.preventDefault();
  document.body.classList.add("is-resizing");
  element.classList.add("dragging");

  const moveHandler = (moveEvent) => {
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

function initializeResizablePanels() {
  els.filesEditorResizer.addEventListener("pointerdown", (event) => {
    if (!isDesktopLayout() || !state.macroSidebarVisible) {
      return;
    }

    const startFilesWidth = getClampedHorizontalWidths().filesWidth;
    startPointerResize(event, {
      axis: "x",
      element: els.filesEditorResizer,
      onMove: (delta) => {
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
      onMove: (delta) => {
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
      onMove: (delta) => {
        layoutState.runtimeHeight = startRuntimeHeight - delta;
        applyEditorLayout();
      },
    });
  });

  layoutState.desktopMq.addEventListener("change", updateLayout);
}

function renderLogs() {
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

function renderDevice() {
  deviceRenderer.render(state.device);
}

function render() {
  renderFiles();
  renderEditor();
  renderLogs();
  renderDevice();
  renderVisibilityState();
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function runMacros() {
  state.device = createDefaultDeviceState();
  renderDevice();
  await executeMacros({
    files: state.files,
    addLog,
    createXapiFacade: () =>
      createXapiFacade({
        device: state.device,
        addLog,
        renderDevice,
      }),
  });
}

function createNewFile() {
  const name = `macro-${state.files.length + 1}.js`;
  const file = createFile(
    name,
    `import xapi from 'xapi';\n\n// Start building your RoomOS macro here.\n`,
  );
  state.files.unshift(file);
  state.activeFileId = file.id;
  render();
}

async function loadSampleMacro() {
  try {
    const response = await fetch("./samples/manifest.json");
    if (!response.ok) {
      throw new Error(`Unable to load samples manifest (${response.status})`);
    }

    const manifest = await response.json();
    const imported = await Promise.all(
      manifest.map(async (sample) => {
        const samplePath = sample.path ?? sample.name;
        const sampleResponse = await fetch(`./samples/${samplePath}`);
        if (!sampleResponse.ok) {
          throw new Error(`Unable to load sample ${samplePath} (${sampleResponse.status})`);
        }

        const file = createFile(sample.name, await sampleResponse.text());
        file.enabled = Boolean(sample.enabled);
        return file;
      }),
    );

    state.files = [...imported, ...state.files];
    state.activeFileId = imported[0]?.id ?? state.activeFileId;
    addLog(`Loaded ${imported.length} sample macro${imported.length === 1 ? "" : "s"} into workspace.`, "success");
    render();
  } catch (error) {
    addLog(`Failed to load sample macros: ${error.message}`, "error");
  }
}

async function handleFileUpload(event) {
  const files = Array.from(event.target.files ?? []);
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
  event.target.value = "";
}

function initializeMonaco() {
  if (monacoReady) {
    return monacoReady;
  }

  monacoReady = initializeMonacoEditor({
    container: els.codeEditor,
    onChange: () => {
      if (isApplyingEditorState) {
        return;
      }

      const activeFile = getActiveFile();
      if (!activeFile) {
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
  }).then((editor) => {
    monacoEditor = editor;
    renderEditor();
    installXapiIntellisense({
      monaco: window.monaco,
      addLog,
    }).catch((error) => {
      addLog(`Failed to load xapi IntelliSense: ${error.message}`, "error");
    });
    return editor;
  });

  return monacoReady;
}

function handleGlobalShortcuts(event) {
  const metaKeyPressed = event.metaKey || event.ctrlKey;
  if (!metaKeyPressed) {
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

els.fileInput.addEventListener("change", handleFileUpload);
hydrateIcons();
initializeProductSelect();
els.newFileButton.addEventListener("click", createNewFile);
els.loadSampleButton.addEventListener("click", loadSampleMacro);
els.runButton.addEventListener("click", runMacros);
els.resetButton.addEventListener("click", () => {
  state.device = createDefaultDeviceState();
  addLog("Simulator state reset.", "success");
  renderDevice();
});
els.logSeverityButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleLogSeverityMenu();
});
els.logSeverityMenu.addEventListener("click", (event) => {
  const resetButton = event.target.closest("[data-log-level-reset]");
  if (resetButton) {
    resetLogSeverityFilters();
    closeLogSeverityMenu();
    return;
  }

  const item = event.target.closest("[data-log-level]");
  if (!item) {
    return;
  }

  toggleLogSeverityFilter(item.dataset.logLevel);
});
els.fileList.addEventListener("click", (event) => {
  if (event.target.closest(".file-toggle")) {
    return;
  }

  const saveButton = event.target.closest(".file-save-button");
  if (saveButton) {
    const item = saveButton.closest(".file-item[data-file-id]");
    const file = getFileById(item?.dataset.fileId);
    if (file) {
      saveFileToDevice(file);
    }
    return;
  }

  const menuButton = event.target.closest(".file-menu-button");
  if (menuButton) {
    const fileId = menuButton.dataset.fileId;
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

  const item = event.target.closest(".file-item[data-file-id]");
  if (!item) {
    return;
  }

  const nextActiveFileId = item.dataset.fileId;
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
  const toggle = event.target.closest(".file-toggle");
  if (!toggle) {
    return;
  }

  const item = toggle.closest(".file-item[data-file-id]");
  const file = getFileById(item?.dataset.fileId);
  if (file) {
    toggleFileEnabled(file);
  }
});
els.logFilterInput.addEventListener("input", (event) => {
  state.logFilterText = event.target.value;
  renderLogs();
});
els.closeHelpButton.addEventListener("click", toggleHelp);

document.addEventListener("click", (event) => {
  if (!event.target.closest(".file-item") && !event.target.closest("#floating-file-menu")) {
    closeFileMenu();
  }

  if (!event.target.closest(".severity-menu-shell")) {
    closeLogSeverityMenu();
  }
});
document.addEventListener("keydown", handleGlobalShortcuts);
window.addEventListener("resize", () => {
  updateLayout();
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
