import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const isDark = theme === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={`Switch to ${next} mode`}
      onClick={() => setTheme(next)}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
