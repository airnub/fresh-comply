"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { Theme } from "@radix-ui/themes";
import { motionCookieName, themeCookieName, type MotionPreference, type ThemePreference } from "./constants";

type ResolvedTheme = "light" | "dark" | "high-contrast";
type ResolvedMotion = "default" | "reduced";

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  motion: MotionPreference;
  resolvedMotion: ResolvedMotion;
  setTheme: (value: ThemePreference) => void;
  setMotion: (value: MotionPreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  if (preference === "high-contrast") {
    return "high-contrast";
  }
  return preference;
}

function resolveMotion(preference: MotionPreference): ResolvedMotion {
  if (preference === "reduced") {
    return "reduced";
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "default";
}

function applyPreferences(theme: ResolvedTheme, motion: ResolvedMotion) {
  const doc = document.documentElement;
  doc.dataset.theme = theme;
  doc.style.setProperty("color-scheme", theme === "dark" ? "dark" : "light");
  doc.dataset.motion = motion === "reduced" ? "reduced" : "default";
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

export function ThemeClientProvider({
  defaultTheme,
  defaultMotion,
  children
}: {
  defaultTheme: ThemePreference;
  defaultMotion: MotionPreference;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemePreference>(defaultTheme);
  const [motion, setMotionState] = useState<MotionPreference>(defaultMotion);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    typeof window === "undefined" ? "light" : resolveTheme(defaultTheme)
  );
  const [resolvedMotion, setResolvedMotion] = useState<ResolvedMotion>(() =>
    typeof window === "undefined" ? "default" : resolveMotion(defaultMotion)
  );
  const systemDarkMedia = useRef<MediaQueryList | null>(null);
  const systemMotionMedia = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    systemDarkMedia.current = window.matchMedia("(prefers-color-scheme: dark)");
    systemMotionMedia.current = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleDarkChange = () => {
      if (theme === "system") {
        const nextTheme = resolveTheme("system");
        const motionSetting = motion === "auto" ? resolveMotion("auto") : "reduced";
        setResolvedTheme(nextTheme);
        applyPreferences(nextTheme, motionSetting);
      }
    };

    const handleMotionChange = () => {
      if (motion === "auto") {
        const nextMotion = resolveMotion("auto");
        setResolvedMotion(nextMotion);
        applyPreferences(resolveTheme(theme), nextMotion);
      }
    };

    systemDarkMedia.current?.addEventListener("change", handleDarkChange);
    systemMotionMedia.current?.addEventListener("change", handleMotionChange);

    return () => {
      systemDarkMedia.current?.removeEventListener("change", handleDarkChange);
      systemMotionMedia.current?.removeEventListener("change", handleMotionChange);
    };
  }, [motion, theme, resolvedMotion, resolvedTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextResolvedTheme = resolveTheme(theme);
    const nextResolvedMotion = motion === "auto" ? resolveMotion("auto") : "reduced";
    setResolvedTheme(nextResolvedTheme);
    setResolvedMotion(nextResolvedMotion);
    applyPreferences(nextResolvedTheme, nextResolvedMotion);
  }, [theme, motion]);

  const setTheme = useCallback((value: ThemePreference) => {
    setThemeState(value);
    setCookie(themeCookieName, value);
  }, []);

  const setMotion = useCallback((value: MotionPreference) => {
    setMotionState(value);
    setCookie(motionCookieName, value);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, motion, resolvedMotion, setTheme, setMotion }),
    [theme, resolvedTheme, motion, resolvedMotion, setTheme, setMotion]
  );

  const appearance = resolvedTheme === "dark" ? "dark" : "light";
  const highContrast = resolvedTheme === "high-contrast";

  return (
    <ThemeContext.Provider value={value}>
      <Theme
        appearance={appearance}
        accentColor="blue"
        grayColor="slate"
        panelBackground="translucent"
        radius="large"
        className={highContrast ? "rt-high-contrast" : undefined}
      >
        {children}
      </Theme>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
