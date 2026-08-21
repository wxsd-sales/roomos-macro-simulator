import type { SurfaceAction } from "../../../modules/devices/surfaceActionButtons.ts";
import { RoundActionIcon } from "./RoundActionIcon.tsx";

interface RoundActionButtonProps {
  action: SurfaceAction;
  tileClass: string;
  buttonClass: string;
  iconClass: string;
  labelClass: string;
  actionIdAttribute: string;
  active?: boolean;
  tabIndex?: number;
  imageClass?: string;
  brandImageClass?: string;
  customImageClass?: string;
  onClick?(): void;
}

export function RoundActionButton({
  action,
  tileClass,
  buttonClass,
  iconClass,
  labelClass,
  actionIdAttribute,
  active = false,
  tabIndex,
  imageClass,
  brandImageClass,
  customImageClass,
  onClick,
}: RoundActionButtonProps) {
  return (
    <div className={tileClass}>
      <button
        className={`${buttonClass}${active ? " active" : ""}`}
        type="button"
        tabIndex={tabIndex}
        {...{ [actionIdAttribute]: action.id }}
        onClick={onClick}
      >
        <span className={iconClass}>
          <RoundActionIcon
            action={action}
            imageClass={imageClass}
            brandImageClass={brandImageClass}
            customImageClass={customImageClass}
          />
        </span>
      </button>
      <span className={labelClass}>{action.label}</span>
    </div>
  );
}
