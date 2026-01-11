"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FolderOpen, BarChart3, Home, Settings } from "lucide-react";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: Home },
  { href: "/admin/projects", label: "Projects", icon: FolderOpen },
  { href: "/admin/responses", label: "Responses", icon: BarChart3 },
  { href: "/admin/account", label: "Account", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r bg-muted/30 p-4 md:flex">
      <div className="mb-6 flex items-center justify-between">
        <Logo subtitle="Admin Panel" href="/admin" />
        <ThemeToggle />
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t pt-4">
        <UserMenu />
      </div>
    </aside>
  );
}
