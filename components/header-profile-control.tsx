"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LogOut, Mail, UserRound } from "lucide-react";
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
import { Input } from "@/components/ui/input";

export function HeaderProfileControl() {
  const { syncConfigured, syncStatus, syncError, session, signInWithEmail, signOut } = useRecipeProfile();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const displayName = mounted && session?.user.email ? session.user.email : "Sign in";
  const accountLabel = mounted && session?.user.email ? `KosherTable account: ${session.user.email}` : "Sign in to KosherTable";

  useEffect(() => {
    setMounted(true);
  }, []);

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    await signInWithEmail(trimmed);
    setAuthMessage("Check your email for a KosherTable sign-in link.");
  }

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
              <form className="space-y-2" onSubmit={submitEmail}>
                <div>
                  <p className="font-medium">{syncConfigured ? "Sync across devices" : "Sync not configured"}</p>
                  <p className="text-xs text-muted-foreground">
                    {syncConfigured
                      ? "Email yourself a magic link to load the same favorites and groceries on phones and tablets."
                      : "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable login sync."}
                  </p>
                </div>
                {syncConfigured ? (
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      aria-label="Email for profile sync"
                    />
                    <Button type="submit" disabled={!email.trim() || syncStatus === "syncing"}>
                      <Mail className="size-4" />
                      Send link
                    </Button>
                  </div>
                ) : null}
                {authMessage ? <p className="text-xs text-muted-foreground">{authMessage}</p> : null}
              </form>
            )}
            {syncError ? <p className="mt-2 text-xs text-destructive">{syncError}</p> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
