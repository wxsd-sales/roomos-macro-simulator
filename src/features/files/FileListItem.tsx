import type { AppFile } from "../../modules/types.ts";
import { Icon } from "../../components/Icon.tsx";
import { getDisplayFileName, isFileDirty } from "./fileUtils.ts";

interface FileListItemProps {
  file: AppFile;
  isActive: boolean;
  isMenuOpen: boolean;
  onSelect(): void;
  onSaveToDevice(event: React.MouseEvent): void;
  onToggleMenu(event: React.MouseEvent): void;
  onToggleEnabled(): void;
}

export function FileListItem({
  file,
  isActive,
  isMenuOpen,
  onSelect,
  onSaveToDevice,
  onToggleMenu,
  onToggleEnabled,
}: FileListItemProps) {
  const dirty = isFileDirty(file);

  return (
    <div
      className={`file-item${isActive ? " active" : ""}`}
      data-file-id={file.id}
      onClick={onSelect}
    >
      <strong className="file-name">{getDisplayFileName(file.name)}</strong>
      {dirty ? (
        <button
          className="file-save-button"
          type="button"
          aria-label={`Save ${file.name} to simulated device`}
          onClick={onSaveToDevice}
        >
          <Icon name="icon-save-regular" />
        </button>
      ) : null}
      <button
        className="file-menu-button"
        type="button"
        data-file-id={file.id}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-label={`File actions for ${file.name}`}
        onClick={onToggleMenu}
      >
        <Icon name="icon-tools-regular" />
      </button>
      <input
        className="file-toggle"
        type="checkbox"
        checked={file.enabled}
        aria-label={`${file.enabled ? "Disable" : "Enable"} ${file.name}`}
        onChange={onToggleEnabled}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

export function getFileMenuButton(fileId: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`.file-menu-button[data-file-id="${fileId}"]`);
}
