"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChefHat, Home, Search, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/generate", label: "Find", icon: Sparkles }
];

function isActiveNav(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href) || (href === "/generate" && pathname.startsWith("/find"));
}

function HeaderRecipeSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRecipeName = searchParams.get("recipeName") ?? "";
  const [query, setQuery] = useState(currentRecipeName);

  useEffect(() => {
    setQuery(currentRecipeName);
  }, [currentRecipeName]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const formQuery = formData.get("recipeName");
    const trimmed = String(formQuery ?? query).trim();
    router.push(trimmed ? `/find?recipeName=${encodeURIComponent(trimmed)}` : "/find");
  }

  return (
    <form className="order-3 flex w-full min-w-0 gap-2 md:order-none md:max-w-xl md:flex-1" onSubmit={submit} role="search">
      <Input
        aria-label="Search recipes"
        name="recipeName"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search recipes"
        className="h-10 min-w-0"
      />
      <Button type="submit" size="icon" aria-label="Search recipes" className="size-10 shrink-0">
        <Search className="size-4" />
      </Button>
    </form>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(231,161,87,0.16),transparent_32rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]">
      <header className="sticky top-0 z-40 border-b bg-background/88 backdrop-blur">
        <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-3 md:flex-nowrap">
          <Link href="/" className="order-1 mr-auto flex min-w-0 items-center gap-2 font-semibold md:mr-0" aria-label={`${APP_NAME} home`}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ChefHat className="size-5" />
            </span>
            <span className="truncate text-lg">{APP_NAME}</span>
          </Link>

          <Suspense fallback={<div className="order-3 h-10 w-full md:order-none md:max-w-xl md:flex-1" />}>
            <HeaderRecipeSearch />
          </Suspense>

          <nav className="order-3 hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActiveNav(pathname, item.href);
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

          <div className="order-2 md:order-none">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container pb-28 pt-6 sm:pt-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/92 backdrop-blur md:hidden" aria-label="Mobile navigation">
        <div className="grid grid-cols-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActiveNav(pathname, item.href);
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
