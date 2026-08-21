import { useLayoutEffect, useRef } from "react";
import type { AppFile } from "../../modules/types.ts";

interface FloatingFileMenuProps {
  file: AppFile;
  anchorButton: HTMLButtonElement | null;
  onSaveToFile(): void;
  onToggleEnabled(): void;
  onRename(): void;
  onDelete(): void;
}

export function FloatingFileMenu({
  file,
  anchorButton,
  onSaveToFile,
  onToggleEnabled,
  onRename,
  onDelete,
}: FloatingFileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !anchorButton) {
      return;
    }

    menu.style.left = "0px";
    menu.style.top = "0px";
    menu.style.visibility = "hidden";

    const frame = requestAnimationFrame(() => {
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

    return () => cancelAnimationFrame(frame);
  }, [anchorButton, file]);

  if (!anchorButton) {
    return null;
  }

  return (
    <div
      id="floating-file-menu"
      ref={menuRef}
      className="file-menu file-menu-floating"
      role="menu"
    >
      <button className="file-menu-item" type="button" role="menuitem" onClick={onSaveToFile}>
        Save to File
      </button>
      <button className="file-menu-item" type="button" role="menuitem" onClick={onToggleEnabled}>
        {file.enabled ? "Disable" : "Enable"}
      </button>
      <div className="file-menu-divider" />
      <button className="file-menu-item" type="button" role="menuitem" onClick={onRename}>
        Rename
      </button>
      <button className="file-menu-item" type="button" role="menuitem" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}
