import { NavLink } from "react-router-dom";
import { Box, Library } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NavBar() {
  const links = [
    { to: "/", icon: Box },
    { to: "/library", icon: Library },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-white nav-glow font-terminal">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-center px-6">
        <div className="flex items-center gap-3">
          {links.map(({ to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-center w-8 h-8 rounded transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
