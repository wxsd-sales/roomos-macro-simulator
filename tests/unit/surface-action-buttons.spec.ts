import { describe, expect, it } from "vitest";
import { getRoundActionIconMarkup } from "../../src/modules/devices/surfaceActionButtons.ts";

describe("surface action buttons", () => {
  it("uses default native icons from the action activity type", () => {
    expect(getRoundActionIconMarkup({ id: "call", label: "Call", activityType: "Call" })).toContain("icon-camera-filled");
    expect(getRoundActionIconMarkup({ id: "webapp", label: "WebApp", activityType: "WebApp" })).toContain("icon-language-regular");
    expect(getRoundActionIconMarkup({ id: "files", label: "Files", activityType: "Files" })).toContain("icon-files-regular");
  });

  it("uses custom icon names or the custom default icon", () => {
    expect(getRoundActionIconMarkup({ id: "lights", label: "Lights", activityType: "Custom", icon: "LightBulb" })).toContain(
      "icon-room-lights-regular",
    );
    expect(getRoundActionIconMarkup({ id: "settings", label: "Settings", activityType: "Custom" })).toContain(
      "icon-adjust-horizontal-regular",
    );
  });

  it("uses custom base64 images when the custom icon name is Custom", () => {
    const markup = getRoundActionIconMarkup({
      id: "button",
      label: "Button",
      activityType: "Custom",
      icon: "Custom",
      customIconDataUri: "iVBORw0KGgo=",
    });

    expect(markup).toContain("<img");
    expect(markup).toContain('src="data:image/png;base64,iVBORw0KGgo="');
  });
});
