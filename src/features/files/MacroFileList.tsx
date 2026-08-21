import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../app/AppProvider.tsx";
import { FileListItem, getFileMenuButton } from "./FileListItem.tsx";
import { FloatingFileMenu } from "./FloatingFileMenu.tsx";
import { useFileActions } from "./useFileActions.ts";

export function MacroFileList() {
  const { state, dispatch } = useAppStore();
  const fileActions = useFileActions();
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null);

  const openFile = state.files.find((file) => file.id === state.openFileMenuId) ?? null;

  useEffect(() => {
    if (!state.openFileMenuId) {
      setMenuAnchor(null);
      return;
    }
    setMenuAnchor(getFileMenuButton(state.openFileMenuId));
  }, [state.openFileMenuId, state.files]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest(".file-item") && !target?.closest("#floating-file-menu")) {
        dispatch({ type: "SET_OPEN_FILE_MENU", fileId: null });
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [dispatch]);

  useEffect(() => {
    const openFileMenuId = state.openFileMenuId;
    const fileList = document.getElementById("file-list");
    if (!fileList || !openFileMenuId) {
      return;
    }

    const handleScroll = () => {
      setMenuAnchor(getFileMenuButton(openFileMenuId));
    };

    fileList.addEventListener("scroll", handleScroll);
    return () => fileList.removeEventListener("scroll", handleScroll);
  }, [state.openFileMenuId]);

  if (!state.files.length) {
    return (
      <div id="file-list" className="file-list">
        <div className="file-item">
          <strong className="file-name">No macros yet</strong>
          <div />
          <div />
        </div>
      </div>
    );
  }

  return (
    <>
      <div id="file-list" className="file-list">
        {state.files.map((file) => (
          <FileListItem
            key={file.id}
            file={file}
            isActive={file.id === state.activeFileId}
            isMenuOpen={file.id === state.openFileMenuId}
            onSelect={() => {
              dispatch({ type: "SET_ACTIVE_FILE", fileId: file.id });
              dispatch({ type: "SET_OPEN_FILE_MENU", fileId: null });
            }}
            onSaveToDevice={(event) => {
              event.stopPropagation();
              fileActions.saveFileToDevice(file);
            }}
            onToggleMenu={(event) => {
              event.stopPropagation();
              dispatch({
                type: "SET_OPEN_FILE_MENU",
                fileId: state.openFileMenuId === file.id ? null : file.id,
              });
            }}
            onToggleEnabled={() => fileActions.toggleFileEnabled(file)}
          />
        ))}
      </div>
      {openFile && menuAnchor
        ? createPortal(
            <FloatingFileMenu
              file={openFile}
              anchorButton={menuAnchor}
              onSaveToFile={() => fileActions.saveFileToDisk(openFile)}
              onToggleEnabled={() => fileActions.toggleFileEnabled(openFile)}
              onRename={() => fileActions.renameFile(openFile)}
              onDelete={() => fileActions.removeFile(openFile)}
            />,
            document.body,
          )
        : null}
    </>
  );
}
