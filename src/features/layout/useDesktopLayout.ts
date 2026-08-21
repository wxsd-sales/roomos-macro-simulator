import { useEffect, useState } from "react";

const DESKTOP_LAYOUT_MEDIA_QUERY = "(min-width: 1160px)";

export function useDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_LAYOUT_MEDIA_QUERY).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_LAYOUT_MEDIA_QUERY);
    const handleChange = () => setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
}
