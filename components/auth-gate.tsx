"use client";

import { ChefHat, LogIn, ShieldCheck } from "lucide-react";
import { useRecipeProfile } from "@/components/recipe-profile-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { syncConfigured, syncStatus, syncError, session, signInWithGoogleAccount } = useRecipeProfile();
  const authenticating = syncStatus === "syncing";

  if (session) return <>{children}</>;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(231,161,87,0.16),transparent_32rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))] px-4 py-10">
      <main className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6 text-card-foreground shadow-2xl shadow-black/20 sm:p-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ChefHat className="size-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-normal">{APP_NAME}</h1>
              <p className="text-sm text-muted-foreground">Google account required</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border bg-secondary/35 p-3 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-muted-foreground">Only approved Google accounts can open the recipe finder, favorites, groceries, or recipe pages.</p>
          </div>
        </div>

        {syncConfigured ? (
          <Button type="button" className="w-full justify-center" size="lg" disabled={authenticating} onClick={signInWithGoogleAccount}>
            <LogIn className="size-4" />
            {authenticating ? "Checking Google access..." : "Continue with Google"}
          </Button>
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Google auth is not configured</AlertTitle>
            <AlertDescription>
              Add Firebase public config and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` before deploying. The app content stays locked until auth is configured.
            </AlertDescription>
          </Alert>
        )}

        {syncError ? (
          <Alert variant="destructive">
            <AlertTitle>Access blocked</AlertTitle>
            <AlertDescription>{syncError}</AlertDescription>
          </Alert>
        ) : null}
      </main>
    </div>
  );
}
