let syncLayout: (() => void) | null = null;

export function registerLayoutSync(fn: () => void): void {
  syncLayout = fn;
}

export function syncLegacyLayout(): void {
  syncLayout?.();
}
