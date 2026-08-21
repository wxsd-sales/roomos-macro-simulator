import {
  resolveSurfaceActionIcon,
  type SurfaceAction,
} from "../../../modules/devices/surfaceActionButtons.ts";
import { Icon } from "../../../components/Icon.tsx";

interface RoundActionIconProps {
  action: SurfaceAction;
  imageClass?: string;
  brandImageClass?: string;
  customImageClass?: string;
}

export function RoundActionIcon({
  action,
  imageClass = "surface-action-image",
  brandImageClass = "surface-brand-action-image",
  customImageClass = "surface-custom-action-image",
}: RoundActionIconProps) {
  const resolvedIcon = resolveSurfaceActionIcon(action);

  if (resolvedIcon.type === "brand") {
    return (
      <img
        className={`${imageClass} ${brandImageClass}`}
        src={resolvedIcon.brand.url}
        alt=""
        aria-hidden
        data-brand-icon={resolvedIcon.brand.label}
      />
    );
  }

  if (resolvedIcon.type === "customImage") {
    return (
      <img
        className={`${imageClass} ${customImageClass}`}
        src={resolvedIcon.url}
        alt=""
        aria-hidden
        data-custom-icon={action.label}
      />
    );
  }

  return <Icon name={resolvedIcon.iconClass} />;
}
