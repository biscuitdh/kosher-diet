"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { RecipeProfileSelector } from "@/components/recipe-profile-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  addCustomGroceryItem,
  clearCheckedGroceryItems,
  clearGroceryItemsForProfile,
  getSelectedRecipeProfile,
  loadGroceryItemsForProfile,
  removeGroceryItem,
  updateGroceryItem
} from "@/lib/storage";
import {
  buildGroceryAgentManifest,
  formatGroceryItem,
  groupGroceryItemsByStore
} from "@/lib/grocery";
import type { GroceryListItem, RecipeProfile } from "@/lib/schemas";

function sourceText(item: GroceryListItem) {
  if (item.sourceRecipes.length === 0) return "Manual item";
  return item.sourceRecipes.map((source) => source.title).join(", ");
}

export function GroceryListClient() {
  const [selectedProfile, setSelectedProfile] = useState<RecipeProfile | undefined>();
  const [items, setItems] = useState<GroceryListItem[]>([]);
  const [customName, setCustomName] = useState("");
  const [customQuantity, setCustomQuantity] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");

  const profileId = selectedProfile?.id;
  const storeGroups = useMemo(() => groupGroceryItemsByStore(items), [items]);
  const fullListText = useMemo(() => items.map(formatGroceryItem).join("\n"), [items]);

  const refreshItems = useCallback((nextProfileId: string) => {
    setItems(loadGroceryItemsForProfile(nextProfileId));
  }, []);

  useEffect(() => {
    const profile = getSelectedRecipeProfile();
    setSelectedProfile(profile);
    refreshItems(profile.id);
  }, [refreshItems]);

  const handleProfileChange = useCallback(
    (profile: RecipeProfile) => {
      setSelectedProfile(profile);
      refreshItems(profile.id);
      setMessage("");
    },
    [refreshItems]
  );

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  }

  function updateItem(item: GroceryListItem, patch: Partial<GroceryListItem>) {
    if (!profileId) return;
    updateGroceryItem({ ...item, ...patch });
    refreshItems(profileId);
  }

  function removeItem(item: GroceryListItem) {
    if (!profileId) return;
    removeGroceryItem(item.id, profileId);
    refreshItems(profileId);
  }

  function submitCustomItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileId || !customName.trim()) return;
    const result = addCustomGroceryItem({ displayName: customName, quantity: customQuantity, unit: customUnit }, profileId);
    refreshItems(profileId);
    setCustomName("");
    setCustomQuantity("");
    setCustomUnit("");
    setMessage(result.added ? "Added custom grocery item." : "Updated matching grocery item.");
  }

  function clearChecked() {
    if (!profileId) return;
    clearCheckedGroceryItems(profileId);
    refreshItems(profileId);
  }

  function clearAll() {
    if (!profileId) return;
    clearGroceryItemsForProfile(profileId);
    refreshItems(profileId);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Groceries</h1>
          <p className="text-muted-foreground">Shopping list for {selectedProfile?.name ?? "the active profile"}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => copyText(fullListText, "full-list")} disabled={items.length === 0}>
            <Copy />
            {copied === "full-list" ? "Copied" : "Copy list"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => copyText(JSON.stringify(buildGroceryAgentManifest(items, profileId ?? "household"), null, 2), "agent-manifest")}
            disabled={storeGroups.length === 0}
          >
            <ShoppingCart />
            {copied === "agent-manifest" ? "Copied" : "Copy agent manifest"}
          </Button>
        </div>
      </div>

      <RecipeProfileSelector onProfileChange={handleProfileChange} />

      {message ? (
        <div className="rounded-lg border bg-secondary/45 p-3 text-sm" role="status">
          {message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add custom item</CardTitle>
          <CardDescription>Add anything that is not already coming from a recipe.</CardDescription>
        </CardHeader>
        <CardContent>
          <form aria-label="Add custom grocery item" className="grid gap-3 md:grid-cols-[1fr_9rem_8rem_auto]" onSubmit={submitCustomItem}>
            <Input aria-label="Custom grocery item" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Apples" />
            <Input aria-label="Custom grocery quantity" value={customQuantity} onChange={(event) => setCustomQuantity(event.target.value)} placeholder="4" />
            <Input aria-label="Custom grocery unit" value={customUnit} onChange={(event) => setCustomUnit(event.target.value)} placeholder="items" />
            <Button type="submit" disabled={!customName.trim()}>
              <Plus />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Shopping list</CardTitle>
            <CardDescription>{items.length} items for this profile.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clearChecked} disabled={!items.some((item) => item.checked)}>
              Clear checked
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearAll} disabled={items.length === 0}>
              Clear all
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-lg border bg-background p-3 lg:grid-cols-[auto_7rem_7rem_1fr_auto] lg:items-start">
                <Checkbox checked={item.checked} onCheckedChange={(checked) => updateItem(item, { checked: Boolean(checked) })} aria-label={`Check ${item.displayName}`} />
                <Input
                  aria-label={`Quantity for ${item.displayName}`}
                  value={item.quantity}
                  onChange={(event) => updateItem(item, { quantity: event.target.value })}
                />
                <Input aria-label={`Unit for ${item.displayName}`} value={item.unit} onChange={(event) => updateItem(item, { unit: event.target.value })} />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={item.checked ? "font-medium text-muted-foreground line-through" : "font-medium"}>{item.displayName}</p>
                    {item.pantryStaple ? <Badge variant="secondary">Pantry</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{sourceText(item)}</p>
                  {item.quantityNotes.length > 0 ? (
                    <p className="text-xs text-muted-foreground">Also added: {item.quantityNotes.join("; ")}</p>
                  ) : null}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => removeItem(item)}>
                  <Trash2 />
                  Remove
                </Button>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Add ingredients from a recipe or create a custom grocery item.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {storeGroups.map((group) => (
          <Card key={group.store}>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{group.label}</CardTitle>
                <CardDescription>{group.items.length} items ready to order.</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyText(group.items.map(({ item }) => formatGroceryItem(item)).join("\n"), group.store)}
              >
                <Copy />
                {copied === group.store ? "Copied" : "Copy"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.items.map(({ item, primaryLink, alternateLinks }) => (
                <div key={`${group.store}-${item.id}`} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{formatGroceryItem(item)}</p>
                      <p className="text-xs text-muted-foreground">{item.shoppingName}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={primaryLink.href} target="_blank" rel="noreferrer">
                          Open
                          <ExternalLink />
                        </a>
                      </Button>
                      {alternateLinks.slice(0, 3).map((link) => (
                        <Button key={`${item.id}-${link.store}`} asChild variant="ghost" size="sm">
                          <a href={link.href} target="_blank" rel="noreferrer">
                            {link.label}
                          </a>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length > 0 && storeGroups.length === 0 ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            No store order groups yet. Checked items and pantry staples stay on the list, but are not included in ordering groups.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
