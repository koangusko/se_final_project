import { useSyncExternalStore } from "react";

/** 例：const isPhone = useMediaQuery("(max-width: 639px)"); */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** 手機寬度（Tailwind 的 sm 以下） */
export const PHONE_QUERY = "(max-width: 639px)";
