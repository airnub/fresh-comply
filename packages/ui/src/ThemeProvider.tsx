import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ThemeClientProvider } from "./theme/ThemeClientProvider";
import { motionCookieName, themeCookieName, type MotionPreference, type ThemePreference } from "./theme/constants";

function serializeBootstrapScript(theme: ThemePreference, motion: MotionPreference) {
  const payload = JSON.stringify({ theme, motion });
  return `(()=>{const data=${payload};const doc=document.documentElement;const systemDark=window.matchMedia('(prefers-color-scheme: dark)').matches;const resolvedTheme=data.theme==='system'?(systemDark?'dark':'light'):data.theme;doc.dataset.theme=resolvedTheme;doc.dataset.motion=data.motion==='reduced'?'reduced':'default';doc.style.setProperty('color-scheme', resolvedTheme==='dark'?'dark':'light');})();`;
}

export async function ThemeProvider({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const storedTheme = (cookieStore.get(themeCookieName)?.value as ThemePreference | undefined) ?? "system";
  const storedMotion = (cookieStore.get(motionCookieName)?.value as MotionPreference | undefined) ?? "auto";

  return (
    <>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeBootstrapScript(storedTheme, storedMotion) }}
      />
      <ThemeClientProvider defaultTheme={storedTheme} defaultMotion={storedMotion}>
        {children}
      </ThemeClientProvider>
    </>
  );
}
