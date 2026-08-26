import { resolveSurfaceActionIcon } from "../../../modules/devices/surfaceActionButtons.ts";

interface MeetingPlatformIconProps {
  platform: string;
  className?: string;
}

/**
 * Brand mark for a booking's meeting platform. Reuses the action-button icon
 * resolver so Webex, Teams, Zoom and Meet stay consistent across surfaces.
 * Renders nothing for platforms without a brand mark.
 */
export function MeetingPlatformIcon({ platform, className = "" }: MeetingPlatformIconProps) {
  const resolved = resolveSurfaceActionIcon({
    id: `platform-${platform}`,
    label: platform,
    activityType: platform,
  });

  if (resolved.type !== "brand") {
    return null;
  }

  return (
    <img
      className={`meeting-platform-icon ${className}`.trim()}
      src={resolved.brand.url}
      alt=""
      aria-hidden
      data-meeting-platform={resolved.brand.label}
    />
  );
}
