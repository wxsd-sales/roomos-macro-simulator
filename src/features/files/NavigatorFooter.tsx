import packageJson from "../../../package.json";
import { Icon } from "../../components/Icon.tsx";

function getMajorVersionLabel(version: string): string {
  const majorVersion = version.trim().split(".")[0];
  return `v${majorVersion || version}`;
}

export function NavigatorFooter() {
  return (
    <footer className="navigator-footer">
      <Icon name="icon-custom-code-editor-regular" />
      <span id="navigator-version">
        RoomOS Macro Simulator {getMajorVersionLabel(packageJson.version)}
      </span>
    </footer>
  );
}
