import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, GraduationCap, Archive, Library, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/useTheme";

export default function NavBar() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const links = [
    { to: "/", icon: BookOpen, label: t("nav.today") },
    { to: "/archive", icon: Archive, label: t("nav.archive") },
    { to: "/library", icon: Library, label: t("nav.library") },
    { to: "/study", icon: GraduationCap, label: t("nav.study") },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl nav-glow font-terminal">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-1">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary text-glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-secondary px-2 py-1 font-medium uppercase text-accent border border-accent/20">
              {i18n.language}
            </span>
            <span>{t("common.language")}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground btn-glow"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
