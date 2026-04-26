"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, Home, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/generate", label: "Generate", icon: Sparkles }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(231,161,87,0.16),transparent_32rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]">
      <header className="sticky top-0 z-40 border-b bg-background/88 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold" aria-label={`${APP_NAME} home`}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ChefHat className="size-5" />
            </span>
            <span className="truncate text-lg">{APP_NAME}</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Button key={item.href} variant={active ? "secondary" : "ghost"} asChild>
                  <Link href={item.href} aria-current={active ? "page" : undefined}>
                    <Icon />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>

          <ThemeToggle />
        </div>
      </header>

      <main className="container pb-28 pt-6 sm:pt-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/92 backdrop-blur md:hidden" aria-label="Mobile navigation">
        <div className="grid grid-cols-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground",
                  active && "text-primary"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
