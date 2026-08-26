import googleMeetIconUrl from "@momentum-design/brand-visuals/dist/svg/google-meet-color.svg?url";
import microsoftTeamsIconUrl from "@momentum-design/brand-visuals/dist/svg/ms-teams-color.svg?url";
import webexAppIconUrl from "@momentum-design/brand-visuals/dist/svg/webex-app-icon-color-container.svg?url";
import zoomIconUrl from "@momentum-design/brand-visuals/dist/svg/zoom-color.svg?url";
import type { DevicePanel } from "../types.ts";
import { normalizeCustomIconDataUri } from "./customIconData.ts";

export interface SurfaceAction {
  id: string;
  label: string;
  activityType: string;
  icon?: string;
  customIconDataUri?: string;
}

interface RoundActionButtonOptions {
  action: SurfaceAction;
  tileClass: string;
  buttonClass: string;
  iconClass: string;
  labelClass: string;
  dataAttribute: string;
  active?: boolean;
  tabIndex?: number;
  imageClass?: string;
  brandImageClass?: string;
  customImageClass?: string;
}

interface RoundActionIconOptions {
  imageClass?: string;
  brandImageClass?: string;
  customImageClass?: string;
}

interface BrandIcon {
  label: string;
  url: string;
}

export type ResolvedActionIcon =
  | { type: "icon"; iconClass: string }
  | { type: "brand"; brand: BrandIcon }
  | { type: "customImage"; url: string };

interface NativeSurfaceAction extends SurfaceAction {
  /** Whiteboarding needs a touch screen, so it never reaches the Controller. */
  osdOnly?: boolean;
}

/**
 * The OSD and the Controller offer the same native buttons. Only whiteboarding
 * is OSD-only, because it requires an interactive (touch) display.
 */
const NATIVE_ACTIONS: NativeSurfaceAction[] = [
  { id: "native-call", label: "Call", activityType: "Call" },
  { id: "native-whiteboard", label: "Whiteboard", activityType: "Whiteboard", osdOnly: true },
  { id: "native-share", label: "Share", activityType: "Share" },
  { id: "native-webex", label: "Webex", activityType: "Webex" },
  { id: "native-zoom", label: "Zoom", activityType: "Zoom" },
  { id: "native-microsoft-teams", label: "Microsoft Teams", activityType: "MicrosoftTeams" },
  { id: "native-google-meet", label: "Google Meet", activityType: "GoogleMeet" },
];

function toSurfaceActions(actions: NativeSurfaceAction[]): SurfaceAction[] {
  return actions.map(({ id, label, activityType }) => ({ id, label, activityType }));
}

export const OSD_NATIVE_ACTIONS: SurfaceAction[] = toSurfaceActions(NATIVE_ACTIONS);

export const CONTROLLER_NATIVE_ACTIONS: SurfaceAction[] = toSurfaceActions(
  NATIVE_ACTIONS.filter((action) => !action.osdOnly),
);

const NATIVE_ICON_CLASSES: Record<string, string> = {
  call: "icon-camera-filled",
  files: "icon-files-regular",
  share: "icon-content-share-regular",
  sharescreen: "icon-content-share-regular",
  webapp: "icon-language-regular",
  whiteboard: "icon-whiteboard-regular",
};

const BRAND_ICONS: Record<string, BrandIcon> = {
  googlemeet: { label: "Google Meet", url: googleMeetIconUrl },
  microsoftteams: { label: "Microsoft Teams", url: microsoftTeamsIconUrl },
  msteams: { label: "Microsoft Teams", url: microsoftTeamsIconUrl },
  teams: { label: "Microsoft Teams", url: microsoftTeamsIconUrl },
  webex: { label: "Webex", url: webexAppIconUrl },
  zoom: { label: "Zoom", url: zoomIconUrl },
};

const CUSTOM_ICON_CLASSES: Record<string, string> = {
  camera: "icon-camera-filled",
  help: "icon-help-regular",
  light: "icon-room-lights-regular",
  lightbulb: "icon-room-lights-regular",
  power: "icon-power-regular",
  sliders: "icon-adjust-regular",
  tv: "icon-display-regular",
};

const DEFAULT_CUSTOM_ICON_CLASS = "icon-adjust-horizontal-regular";

function escapeHtml(text: unknown): string {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(text: unknown): string {
  return escapeHtml(text).replaceAll("`", "&#96;");
}

function normalizeToken(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getIconClassMarkup(iconClass: string): string {
  return `<span class="momentum-icon icon ${escapeAttribute(iconClass)}" aria-hidden="true"></span>`;
}

function getImageMarkup({
  url,
  label,
  imageClass,
  modifierClass,
  dataAttribute,
}: {
  url: string;
  label: string;
  imageClass: string;
  modifierClass: string;
  dataAttribute: string;
}): string {
  return `
    <img
      class="${escapeAttribute(`${imageClass} ${modifierClass}`)}"
      src="${escapeAttribute(url)}"
      alt=""
      aria-hidden="true"
      ${dataAttribute}="${escapeAttribute(label)}"
    />
  `;
}

function resolveCustomActionIcon(action: SurfaceAction): ResolvedActionIcon {
  const iconToken = normalizeToken(action.icon);

  if (iconToken === "custom") {
    const customIconDataUri = normalizeCustomIconDataUri(action.customIconDataUri);
    if (customIconDataUri) {
      return { type: "customImage", url: customIconDataUri };
    }
  }

  return {
    type: "icon",
    iconClass: CUSTOM_ICON_CLASSES[iconToken] ?? DEFAULT_CUSTOM_ICON_CLASS,
  };
}

export function getSurfaceActionFromPanel(panel: DevicePanel, index: number): SurfaceAction {
  const id = panel.id || `panel-${index + 1}`;
  const label = panel.name || panel.id || `Action ${index + 1}`;

  return {
    id,
    label,
    activityType: panel.activityType || "Custom",
    icon: panel.icon,
    customIconDataUri: panel.customIconDataUri,
  };
}

export function resolveSurfaceActionIcon(action: SurfaceAction): ResolvedActionIcon {
  const activityTypeToken = normalizeToken(action.activityType || action.label);
  const iconToken = normalizeToken(action.icon);

  if (activityTypeToken === "custom") {
    return resolveCustomActionIcon(action);
  }

  const brandIcon = BRAND_ICONS[activityTypeToken] ?? BRAND_ICONS[iconToken];
  if (brandIcon) {
    return { type: "brand", brand: brandIcon };
  }

  const iconClass = NATIVE_ICON_CLASSES[activityTypeToken] ?? NATIVE_ICON_CLASSES[iconToken];
  if (iconClass) {
    return { type: "icon", iconClass };
  }

  return resolveCustomActionIcon(action);
}

export function getRoundActionIconMarkup(action: SurfaceAction, options: RoundActionIconOptions = {}): string {
  const {
    imageClass = "surface-action-image",
    brandImageClass = "surface-brand-action-image",
    customImageClass = "surface-custom-action-image",
  } = options;
  const resolvedIcon = resolveSurfaceActionIcon(action);

  if (resolvedIcon.type === "brand") {
    return getImageMarkup({
      url: resolvedIcon.brand.url,
      label: resolvedIcon.brand.label,
      imageClass,
      modifierClass: brandImageClass,
      dataAttribute: "data-brand-icon",
    });
  }

  if (resolvedIcon.type === "customImage") {
    return getImageMarkup({
      url: resolvedIcon.url,
      label: action.label,
      imageClass,
      modifierClass: customImageClass,
      dataAttribute: "data-custom-icon",
    });
  }

  return getIconClassMarkup(resolvedIcon.iconClass);
}

export function createRoundActionButtonMarkup({
  action,
  tileClass,
  buttonClass,
  iconClass,
  labelClass,
  dataAttribute,
  active = false,
  tabIndex,
  imageClass,
  brandImageClass,
  customImageClass,
}: RoundActionButtonOptions): string {
  const activeClass = active ? " active" : "";
  const tabIndexAttribute = typeof tabIndex === "number" ? ` tabindex="${tabIndex}"` : "";

  return `
    <div class="${escapeAttribute(tileClass)}">
      <button
        class="${escapeAttribute(`${buttonClass}${activeClass}`)}"
        type="button"
        ${tabIndexAttribute}
        ${dataAttribute}="${escapeAttribute(action.id)}"
      >
        <span class="${escapeAttribute(iconClass)}">${getRoundActionIconMarkup(action, {
          imageClass,
          brandImageClass,
          customImageClass,
        })}</span>
      </button>
      <span class="${escapeAttribute(labelClass)}">${escapeHtml(action.label)}</span>
    </div>
  `;
}
