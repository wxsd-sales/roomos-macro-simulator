import type { AddLog, DevicePanel, DeviceState } from "../../../../types.ts";

type XapiPayload = Record<string, unknown>;
type EmitEvent = (path: string, payload: unknown) => void;

interface CreatePanelCommandHandlerOptions {
  device: DeviceState;
  addLog: AddLog;
  emitEvent: EmitEvent;
}

interface ParsedPanel {
  id?: string;
  name?: string;
  activityType?: string;
  icon?: string;
  location?: string;
}

export const PANEL_COMMAND_PATHS = new Set([
  "UserInterface.Extensions.Panel.Clicked",
  "UserInterface.Extensions.Panel.Close",
  "UserInterface.Extensions.Panel.Open",
  "UserInterface.Extensions.Panel.Remove",
  "UserInterface.Extensions.Panel.Save",
  "UserInterface.Extensions.Panel.Update",
]);

export const PANEL_EVENT_PATHS = new Set([
  "UserInterface.Extensions.Panel.Clicked",
  "UserInterface.Extensions.Panel.Close",
  "UserInterface.Extensions.Panel.Open",
]);

function toPayload(value: unknown): XapiPayload {
  return value && typeof value === "object" && !Array.isArray(value) ? value as XapiPayload : {};
}

function toStringValue(value: unknown, fallback = ""): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function getXmlText(node: Element, tagName: string): string {
  return node.querySelector(tagName)?.textContent?.trim() ?? "";
}

function parseWithDomParser(xml: string): ParsedPanel[] | null {
  if (!globalThis.DOMParser) {
    return null;
  }

  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) {
    return [];
  }

  return Array.from(document.querySelectorAll("Panel")).map((panel) => ({
    id: getXmlText(panel, "PanelId") || undefined,
    name: getXmlText(panel, "Name") || undefined,
    activityType: getXmlText(panel, "ActivityType") || undefined,
    icon: getXmlText(panel, "Icon") || undefined,
    location: getXmlText(panel, "Location") || undefined,
  }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTagText(xml: string, tagName: string): string {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, "i");
  return pattern.exec(xml)?.[1]?.trim() ?? "";
}

function parseWithFallback(xml: string): ParsedPanel[] {
  const panels = [...xml.matchAll(/<Panel\b[^>]*>([\s\S]*?)<\/Panel>/gi)].map((match) => match[1] ?? "");
  const panelXmlBlocks = panels.length ? panels : [xml];

  return panelXmlBlocks.map((panelXml) => ({
    id: extractTagText(panelXml, "PanelId") || undefined,
    name: extractTagText(panelXml, "Name") || undefined,
    activityType: extractTagText(panelXml, "ActivityType") || undefined,
    icon: extractTagText(panelXml, "Icon") || undefined,
    location: extractTagText(panelXml, "Location") || undefined,
  }));
}

function parsePanelsXml(xml: unknown): ParsedPanel[] {
  const normalizedXml = toStringValue(xml);
  if (!normalizedXml) {
    return [];
  }

  return parseWithDomParser(normalizedXml) ?? parseWithFallback(normalizedXml);
}

function createPanelFromXml({
  payload,
  parsedPanel,
  rawXml,
  index,
  existingCount,
}: {
  payload: XapiPayload;
  parsedPanel: ParsedPanel;
  rawXml: string;
  index: number;
  existingCount: number;
}): DevicePanel {
  const id = toStringValue(
    parsedPanel.id ?? payload.PanelId ?? payload.PanelID ?? payload.Id,
    `panel-${existingCount + index + 1}`,
  );

  return {
    id,
    name: toStringValue(payload.Name ?? parsedPanel.name, id),
    activityType: toStringValue(payload.ActivityType ?? parsedPanel.activityType, "Custom"),
    icon: toStringValue(payload.Icon ?? parsedPanel.icon),
    location: toStringValue(payload.Location ?? parsedPanel.location, "HomeScreen"),
    rawXml,
  };
}

function upsertPanel(device: DeviceState, panel: DevicePanel): void {
  const existing = device.panels.find((entry) => entry.id === panel.id);
  if (existing) {
    Object.assign(existing, panel);
    return;
  }

  device.panels.push(panel);
}

function getPanelEventPayload(payload: XapiPayload, panelId: string): Record<string, unknown> {
  return {
    PanelId: panelId,
    Origin: payload.Origin ?? "local",
    PeripheralId: payload.PeripheralId ?? "",
  };
}

export function createPanelCommandHandler({
  device,
  addLog,
  emitEvent,
}: CreatePanelCommandHandlerOptions) {
  function savePanels(args: unknown[], mode: "saved" | "updated"): Record<string, unknown> {
    const payload = toPayload(args[0]);
    const rawXml = toStringValue(args[1] ?? payload.XML ?? payload.Xml ?? payload.Body);
    const parsedPanels = parsePanelsXml(rawXml);
    const panelInputs = parsedPanels.length ? parsedPanels : [{}];
    const savedPanels = panelInputs.map((parsedPanel, index) =>
      createPanelFromXml({
        payload,
        parsedPanel,
        rawXml,
        index,
        existingCount: device.panels.length,
      }),
    );

    savedPanels.forEach((panel) => upsertPanel(device, panel));

    addLog(
      `${mode === "saved" ? "Saved" : "Updated"} ${savedPanels.length} UI extension panel${savedPanels.length === 1 ? "" : "s"}.`,
      "success",
    );

    return {
      PanelId: savedPanels[0]?.id ?? "",
      Panels: savedPanels.map((panel) => ({
        PanelId: panel.id,
        Name: panel.name,
        ActivityType: panel.activityType,
        Icon: panel.icon,
        Location: panel.location,
      })),
    };
  }

  function openPanel(payload: XapiPayload): Record<string, unknown> {
    const panelId = toStringValue(payload.PanelId ?? payload.PanelID ?? payload.Id, "Unknown");
    device.activePanel = panelId;
    const eventPayload = getPanelEventPayload(payload, panelId);
    emitEvent("UserInterface.Extensions.Panel.Open", eventPayload);
    addLog(`Opened panel ${panelId}`, "success");
    return eventPayload;
  }

  function closePanel(payload: XapiPayload): Record<string, unknown> {
    const panelId = toStringValue(payload.PanelId ?? payload.PanelID ?? payload.Id, device.activePanel);
    if (device.activePanel === panelId) {
      device.activePanel = "Home";
    }

    const eventPayload = getPanelEventPayload(payload, panelId);
    emitEvent("UserInterface.Extensions.Panel.Close", eventPayload);
    addLog(`Closed panel ${panelId}`, "success");
    return eventPayload;
  }

  function clickPanel(payload: XapiPayload): Record<string, unknown> {
    const panelId = toStringValue(payload.PanelId ?? payload.PanelID ?? payload.Id, device.activePanel);
    const eventPayload = getPanelEventPayload(payload, panelId);
    emitEvent("UserInterface.Extensions.Panel.Clicked", eventPayload);
    addLog(`Clicked panel ${panelId}`, "success");
    return eventPayload;
  }

  function removePanel(payload: XapiPayload): Record<string, unknown> {
    const panelId = toStringValue(payload.PanelId ?? payload.PanelID ?? payload.Id);
    const initialPanelCount = device.panels.length;
    device.panels = device.panels.filter((panel) => panel.id !== panelId);
    if (device.activePanel === panelId) {
      device.activePanel = "Home";
    }

    const removed = device.panels.length !== initialPanelCount;
    addLog(`${removed ? "Removed" : "Could not find"} panel ${panelId || "(missing PanelId)"}.`, removed ? "success" : "warn");
    return {
      PanelId: panelId,
      Removed: removed,
    };
  }

  function handle(path: string, args: unknown[] = []): unknown {
    const payload = toPayload(args[0]);

    switch (path) {
      case "UserInterface.Extensions.Panel.Clicked":
        return clickPanel(payload);
      case "UserInterface.Extensions.Panel.Close":
        return closePanel(payload);
      case "UserInterface.Extensions.Panel.Open":
        return openPanel(payload);
      case "UserInterface.Extensions.Panel.Remove":
        return removePanel(payload);
      case "UserInterface.Extensions.Panel.Save":
        return savePanels(args, "saved");
      case "UserInterface.Extensions.Panel.Update":
        return savePanels(args, "updated");
      default:
        return undefined;
    }
  }

  return {
    canHandle(path: string): boolean {
      return PANEL_COMMAND_PATHS.has(path);
    },
    handle,
  };
}
