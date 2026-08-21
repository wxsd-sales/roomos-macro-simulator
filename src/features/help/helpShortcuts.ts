export const HELP_SHORTCUTS = [
  { keys: "`Meta + S` / `Meta + Enter`", description: "Save current macro to device and restart runtime" },
  { keys: "`Meta + E`", description: "Export current macro to file" },
  { keys: "`Meta + O`", description: "Import from file" },
  { keys: "`Meta + Shift + N`", description: "Create new macro" },
  { keys: "`Meta + Shift + H`", description: "Toggle help" },
  { keys: "`Meta + Shift + G`", description: "Toggle log" },
  { keys: "`Meta + Shift + M`", description: "Toggle macro sidebar" },
  { keys: "`Ctrl + Space`", description: "Auto-complete in Monaco" },
  { keys: "`Meta + Z` / `Meta + Shift + Z`", description: "Undo / Redo in Monaco" },
  { keys: "`Meta + F`", description: "Search in Monaco" },
  { keys: "`Meta + /`", description: "Toggle comment in Monaco" },
  { keys: "`Tab` / `Shift + Tab`", description: "Indent / un-indent in Monaco" },
] as const;
