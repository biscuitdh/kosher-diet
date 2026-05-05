"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ChefHat, Heart, Search, ShoppingCart, WandSparkles } from "lucide-react";
import { HeaderProfileControl } from "@/components/header-profile-control";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Create", icon: WandSparkles },
  { href: "/find", label: "Browse", icon: BookOpen },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/groceries", label: "Groceries", icon: ShoppingCart }
];

function isActiveNav(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/generate";
  return pathname.startsWith(href);
}

function HeaderRecipeSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRecipeName = searchParams.get("recipeName") ?? "";
  const [query, setQuery] = useState(currentRecipeName);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const previousRecipeName = useRef(currentRecipeName);
  const searchWrapperRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (previousRecipeName.current === currentRecipeName) return;
    previousRecipeName.current = currentRecipeName;
    setQuery(currentRecipeName);
  }, [currentRecipeName]);

  useEffect(() => {
    const trimmed = query.trim();
    let ignore = false;

    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const { searchCatalogRecipes } = await import("@/lib/catalog");
      if (ignore) return;
      const nextSuggestions = searchCatalogRecipes({ recipeName: trimmed }, 6)
        .map((record) => record.recipe.title)
        .filter((title, index, titles) => titles.indexOf(title) === index);
      setSuggestions(nextSuggestions);
    }, 120);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!searchWrapperRef.current?.contains(event.target as Node)) setSuggestionsOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function openSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();
    setSuggestionsOpen(false);
    router.push(trimmed ? `/find?recipeName=${encodeURIComponent(trimmed)}` : "/find");
  }

  function updateSearchQuery(nextQuery: string) {
    setQuery(nextQuery);
    setSuggestionsOpen(true);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const formQuery = formData.get("recipeName");
    const trimmed = String(formQuery ?? query).trim();
    openSearch(trimmed);
  }

  const trimmedQuery = query.trim();
  const visibleSuggestions = suggestions.length > 0 ? suggestions : trimmedQuery.length >= 2 ? [trimmedQuery] : [];

  return (
    <form
      ref={searchWrapperRef}
      className="relative order-3 flex w-full min-w-0 gap-2 xl:order-2 xl:w-[clamp(18rem,30vw,30rem)] xl:flex-none"
      onSubmit={submit}
      role="search"
    >
      <div className="relative min-w-0 flex-1">
        <Input
          aria-label="Search recipes"
          name="recipeName"
          value={query}
          onChange={(event) => updateSearchQuery(event.target.value)}
          onInput={(event) => updateSearchQuery(event.currentTarget.value)}
          onFocus={() => setSuggestionsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSuggestionsOpen(false);
          }}
          placeholder="Search recipes"
          className="min-w-0"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={suggestionsOpen && visibleSuggestions.length > 0}
          aria-controls="recipe-search-suggestions"
        />
        {suggestionsOpen && visibleSuggestions.length > 0 ? (
          <div
            id="recipe-search-suggestions"
            role="listbox"
            aria-label="Recipe search suggestions"
            className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
          >
            {visibleSuggestions.map((title) => (
              <button
                key={title}
                type="button"
                role="option"
                aria-selected="false"
                className="block min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-secondary focus-ring"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => openSearch(title)}
              >
                <span className="line-clamp-1">{title}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <Button type="submit" size="icon" aria-label="Search recipes" className="shrink-0">
        <Search className="size-4" />
      </Button>
    </form>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top_left,rgba(231,161,87,0.16),transparent_32rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]">
      <header className="sticky top-0 z-40 border-b bg-background/88 backdrop-blur">
        <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-3 xl:flex-nowrap xl:justify-start">
          <div className="order-1 mr-auto flex min-w-0 items-center gap-3 xl:mr-0 xl:shrink-0">
            <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold" aria-label={`${APP_NAME} home`}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <ChefHat className="size-5" />
              </span>
              <span className="hidden truncate text-lg min-[360px]:inline">{APP_NAME}</span>
            </Link>

            <nav className="hidden shrink-0 items-center gap-1 xl:flex" aria-label="Primary navigation">
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
          </div>

          <Suspense fallback={<div className="order-3 h-11 w-full xl:order-2 xl:w-[clamp(18rem,30vw,30rem)] xl:flex-none" />}>
            <HeaderRecipeSearch />
          </Suspense>

          <div className="order-2 flex shrink-0 items-center gap-2 xl:order-3 xl:ml-auto">
            <ThemeToggle />
            <HeaderProfileControl />
          </div>
        </div>
      </header>

      <main className="container min-h-[calc(100dvh-4rem)] pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 sm:pt-7 xl:pb-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/92 backdrop-blur xl:hidden" aria-label="Mobile navigation">
        <div className="grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
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
