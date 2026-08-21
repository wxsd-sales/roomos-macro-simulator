import type { AppFile } from "../../modules/types.ts";

export function getDisplayFileName(name: string): string {
  return name.replace(/\.(js|mjs|txt)$/i, "");
}

export function isFileDirty(file: AppFile): boolean {
  return file.content !== file.deviceContent;
}

export function createMacroFile(name: string, content = ""): AppFile {
  return {
    id: crypto.randomUUID(),
    name,
    content,
    deviceContent: content,
    enabled: true,
  };
}
