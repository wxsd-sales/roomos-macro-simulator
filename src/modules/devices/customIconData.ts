function getStringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function getImageMimeType(base64: string): string {
  if (base64.startsWith("/9j/")) {
    return "image/jpeg";
  }

  if (base64.startsWith("R0lGOD")) {
    return "image/gif";
  }

  if (base64.startsWith("UklGR")) {
    return "image/webp";
  }

  if (base64.startsWith("PHN2Zy") || base64.startsWith("PD94bW")) {
    return "image/svg+xml";
  }

  return "image/png";
}

export function normalizeCustomIconDataUri(value: unknown): string | undefined {
  const rawValue = getStringValue(value);
  if (!rawValue) {
    return undefined;
  }

  if (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(rawValue)) {
    return rawValue.replace(/\s+/g, "");
  }

  const normalizedBase64 = rawValue.replace(/\s+/g, "");
  if (!/^[a-z0-9+/=]+$/i.test(normalizedBase64)) {
    return undefined;
  }

  return `data:${getImageMimeType(normalizedBase64)};base64,${normalizedBase64}`;
}
