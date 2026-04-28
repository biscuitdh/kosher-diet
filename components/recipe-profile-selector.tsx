"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createRecipeProfile,
  getSelectedRecipeProfile,
  loadRecipeProfiles,
  selectRecipeProfile,
  upsertRecipeProfile
} from "@/lib/storage";
import type { RecipeProfile } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type RecipeProfileSelectorProps = {
  className?: string;
  onProfileChange?: (profile: RecipeProfile) => void;
};

export function RecipeProfileSelector({ className, onProfileChange }: RecipeProfileSelectorProps) {
  const [profiles, setProfiles] = useState<RecipeProfile[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draftName, setDraftName] = useState("");

  const loadProfiles = useCallback(() => {
    const nextProfiles = loadRecipeProfiles();
    const selected = getSelectedRecipeProfile();
    setProfiles(nextProfiles);
    setSelectedId(selected.id);
    onProfileChange?.(selected);
  }, [onProfileChange]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  function chooseProfile(profileId: string) {
    selectRecipeProfile(profileId);
    loadProfiles();
  }

  function addProfile() {
    const profile = createRecipeProfile(draftName || `Profile ${profiles.length + 1}`);
    upsertRecipeProfile(profile, true);
    setDraftName("");
    loadProfiles();
  }

  return (
    <div className={cn("rounded-lg border bg-card p-3", className)}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <UsersRound className="size-4 text-primary" />
        Recipe profile
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(10rem,1fr)_minmax(9rem,0.85fr)_auto]">
        <Select value={selectedId} onValueChange={chooseProfile}>
          <SelectTrigger aria-label="Recipe profile">
            <SelectValue placeholder="Choose profile" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          placeholder="New profile"
          aria-label="New recipe profile name"
        />
        <Button type="button" variant="outline" onClick={addProfile}>
          <Plus />
          Add
        </Button>
      </div>
    </div>
  );
}
