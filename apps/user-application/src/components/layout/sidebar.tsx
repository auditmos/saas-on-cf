import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Home, Menu } from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

interface NavigationItem {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string | number;
}

const navigationItems: NavigationItem[] = [
  {
    name: "Dashboard",
    icon: Home,
    href: "/dashboard",
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={cn(
          "hidden lg:flex lg:flex-col lg:border-r lg:border-border lg:bg-background",
          isCollapsed ? "lg:w-16" : "lg:w-64",
          "transition-all duration-300 ease-in-out",
          className
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-border">
          {!isCollapsed && (
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Dashboard
            </h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = currentPath === item.href || 
                (item.href !== "/dashboard" && currentPath.startsWith(item.href));
              
              return (
                <Button
                  key={item.name}
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 h-10",
                    isCollapsed && "px-2 justify-center",
                    isActive && "bg-primary text-primary-foreground shadow-sm",
                    !isActive && "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  onClick={() => navigate({ to: item.href })}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="truncate">{item.name}</span>
                      {item.badge && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="border-t border-border p-4">
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 bg-muted/50",
              isCollapsed && "justify-center"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              U
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-sm font-medium text-foreground">User</span>
                <span className="text-xs text-muted-foreground truncate">
                  user@example.com
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <div className="lg:hidden">
        {/* Mobile implementation can be added here with a sheet/drawer */}
      </div>
    </>
  );
}