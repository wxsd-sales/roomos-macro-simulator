import { useRef } from "react";
import { NavigatorFooter } from "./NavigatorFooter.tsx";
import { MacroFileList } from "./MacroFileList.tsx";
import { useFileActions } from "./useFileActions.ts";

interface MacroFilesPanelProps {
  hidden: boolean;
}

function panelClassName(baseClass: string, hidden: boolean): string {
  return hidden ? `${baseClass} hidden-panel` : baseClass;
}

export function MacroFilesPanel({ hidden }: MacroFilesPanelProps) {
  const fileActions = useFileActions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section id="files-panel" className={panelClassName("panel files-panel", hidden)}>
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Macros</p>
        </div>
      </div>
      <div className="files-actions">
        <label className="file-action-card upload-button">
          <input
            id="file-input"
            ref={fileInputRef}
            type="file"
            accept=".js,.mjs,.txt"
            multiple
            onChange={(event) => {
              void fileActions.handleFileUpload(event.target.files);
              event.target.value = "";
            }}
          />
          <span>Import from file...</span>
        </label>
        <button
          id="new-file-button"
          className="file-action-card"
          type="button"
          onClick={fileActions.createNewFile}
        >
          Create new macro
        </button>
      </div>
      <MacroFileList />
      <NavigatorFooter />
    </section>
  );
}
