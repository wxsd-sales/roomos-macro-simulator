import { useMemo } from "react";
import type { DeviceState } from "../../../modules/types.ts";
import {
  getSurfaceActionFromPanel,
  OSD_NATIVE_ACTIONS,
} from "../../../modules/devices/surfaceActionButtons.ts";
import { Icon } from "../../../components/Icon.tsx";
import { RoundActionButton } from "./RoundActionButton.tsx";

interface OsdSurfaceProps {
  device: DeviceState;
  onSelectPanel(panelId: string): void;
}

export function OsdSurface({ device, onSelectPanel }: OsdSurfaceProps) {
  const clock = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const actions = useMemo(
    () => [...OSD_NATIVE_ACTIONS, ...device.panels.map(getSurfaceActionFromPanel)].slice(0, 16),
    [device.panels],
  );

  return (
    <div className="device-card osd-card">
      <div className="osd-home">
        <div className="osd-stage">
          <div className="osd-topbar">
            <button className="osd-workspace-name" type="button">
              <span data-workspace-name>{device.workspaceName ?? "Workspace Name"}</span>
              <span className="osd-workspace-chevron" aria-hidden="true">
                ›
              </span>
            </button>
            <div className="osd-statusbar">
              <span className="osd-status-item" aria-hidden="true">
                <Icon name="icon-airplay-regular" className="momentum-icon osd-status-icon" />
                <span>AirPlay</span>
              </span>
              <span className="osd-status-item" aria-hidden="true">
                <Icon name="icon-device-connection-regular" className="momentum-icon osd-status-icon" />
                <span>Miracast</span>
              </span>
              <span data-device-clock className="osd-clock">
                {clock}
              </span>
            </div>
          </div>

          <div className="osd-actions-shell">
            <div data-osd-actions className="osd-actions-grid">
              {actions.map((action) => {
                const isActive =
                  device.activePanel === action.id ||
                  device.activePanel === action.label ||
                  (!device.panels.length && action.id === "native-call");

                return (
                  <RoundActionButton
                    key={action.id}
                    action={action}
                    tileClass="osd-action-tile"
                    buttonClass="osd-action-button"
                    iconClass="osd-action-icon"
                    labelClass="osd-action-label"
                    actionIdAttribute="data-osd-action"
                    active={isActive}
                    tabIndex={-1}
                    imageClass="osd-action-image"
                    brandImageClass="osd-brand-action-image"
                    customImageClass="surface-custom-action-image"
                    onClick={() => onSelectPanel(action.id)}
                  />
                );
              })}
            </div>
          </div>

          <div className="osd-page-indicator" aria-hidden="true">
            <span className="osd-page-dot active" />
            <span className="osd-page-dot" />
          </div>

          <div className="osd-edge-handle" aria-hidden="true">
            <span>❮</span>
          </div>

          <div className="osd-home-indicator" aria-hidden="true" />

          <div
            data-alert-layer
            className={`osd-alert-layer${device.alert ? "" : " hidden"}`}
          >
            <div className="osd-alert-card" role="status" aria-live="polite">
              <span className="osd-alert-icon">
                <Icon name="icon-priority-circle-regular" />
              </span>
              <div className="osd-alert-copy">
                <h4 data-alert-title>{device.alert?.title ?? "Alert title"}</h4>
                <p data-alert-text>{device.alert?.text ?? "Alert text"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
