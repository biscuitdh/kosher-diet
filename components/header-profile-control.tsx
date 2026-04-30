"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { useRecipeProfile } from "@/components/recipe-profile-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

export function HeaderProfileControl() {
  const { syncConfigured, syncStatus, syncError, session, signInWithGoogleAccount, signOut } = useRecipeProfile();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const displayName = mounted && session?.user.email ? session.user.email : "Sign in";
  const accountLabel = mounted && session?.user.email ? `KosherTable account: ${session.user.email}` : "Sign in to KosherTable";

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-w-[7rem] shrink-0 gap-2 sm:max-w-[11rem]"
          aria-label={accountLabel}
        >
          <UserRound className="size-4" />
          <span className="truncate">{displayName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>KosherTable account</DialogTitle>
          <DialogDescription>Sign in once and use the same favorites and groceries on every device.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-secondary/35 p-3 text-sm">
            {session ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Signed in as {session.user.email ?? "signed-in user"}</p>
                  <p className="text-xs text-muted-foreground">
                    {syncStatus === "syncing" ? "Syncing favorites and groceries..." : "Favorites and groceries sync across devices."}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={signOut}>
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="font-medium">{syncConfigured ? "Sync across devices" : "Sync not configured"}</p>
                  <p className="text-xs text-muted-foreground">
                    {syncConfigured
                      ? "Continue with Google to load the same favorites and groceries on phones and tablets."
                      : "Add Firebase config and NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable login sync."}
                  </p>
                </div>
                {syncConfigured ? (
                  <Button type="button" className="w-full justify-center" disabled={syncStatus === "syncing"} onClick={signInWithGoogleAccount}>
                    <LogIn className="size-4" />
                    Continue with Google
                  </Button>
                ) : null}
              </div>
            )}
            {syncError ? <p className="mt-2 text-xs text-destructive">{syncError}</p> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
