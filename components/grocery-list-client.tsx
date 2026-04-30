"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, ListChecks, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useRecipeProfile } from "@/components/recipe-profile-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  addCustomGroceryItem,
  clearCheckedGroceryItems,
  clearGroceryItemsForProfile,
  loadGroceryItemsForProfile,
  removeGroceryItem,
  updateGroceryItem
} from "@/lib/storage";
import {
  buildWalmartCartAgentPrompt,
  formatGroceryItem,
  groupSpecialtyKosherMeatItemsByStore,
  sortGroceryItemsForDisplay,
  walmartOrderItems
} from "@/lib/grocery";
import { CLOUD_DATA_LOADED_EVENT } from "@/lib/constants";
import type { GroceryListItem } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export function GroceryListClient() {
  const searchParams = useSearchParams();
  const { selectedProfile } = useRecipeProfile();
  const [items, setItems] = useState<GroceryListItem[]>([]);
  const [customName, setCustomName] = useState("");
  const [customQuantity, setCustomQuantity] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");

  const profileId = selectedProfile.id;
  const storeView = searchParams.get("view") === "store";
  const sortedItems = useMemo(() => sortGroceryItemsForDisplay(items), [items]);
  const meatStoreGroups = useMemo(() => groupSpecialtyKosherMeatItemsByStore(items), [items]);
  const walmartItems = useMemo(() => walmartOrderItems(items), [items]);
  const fullListText = useMemo(() => sortedItems.map(formatGroceryItem).join("\n"), [sortedItems]);

  const refreshItems = useCallback((nextProfileId: string) => {
    setItems(loadGroceryItemsForProfile(nextProfileId));
  }, []);

  useEffect(() => {
    refreshItems(selectedProfile.id);
    setMessage("");
  }, [refreshItems, selectedProfile.id]);

  useEffect(() => {
    function refreshFromCloud() {
      refreshItems(selectedProfile.id);
    }

    window.addEventListener(CLOUD_DATA_LOADED_EVENT, refreshFromCloud);
    return () => window.removeEventListener(CLOUD_DATA_LOADED_EVENT, refreshFromCloud);
  }, [refreshItems, selectedProfile.id]);

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
    updateGroceryItem({ ...item, ...patch });
    refreshItems(profileId);
  }

  function removeItem(item: GroceryListItem) {
    removeGroceryItem(item.id, profileId);
    refreshItems(profileId);
  }

  function submitCustomItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customName.trim()) return;
    const result = addCustomGroceryItem({ displayName: customName, quantity: customQuantity, unit: customUnit }, profileId);
    refreshItems(profileId);
    setCustomName("");
    setCustomQuantity("");
    setCustomUnit("");
    setMessage(result.added ? "Added custom grocery item." : "Updated matching grocery item.");
  }

  function clearChecked() {
    clearCheckedGroceryItems(profileId);
    refreshItems(profileId);
  }

  function clearAll() {
    clearGroceryItemsForProfile(profileId);
    refreshItems(profileId);
  }

  const storeChecklist = (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className={storeView ? "" : "sr-only"}>{storeView ? "Store checklist" : "Shopping list"}</CardTitle>
          <CardDescription>{items.length} items</CardDescription>
        </div>
        {!storeView ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clearChecked} disabled={!items.some((item) => item.checked)}>
              Clear checked
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearAll} disabled={items.length === 0}>
              Clear all
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 ? (
          sortedItems.map((item) =>
            storeView ? (
              <button
                key={item.id}
                type="button"
                data-testid="store-grocery-row"
                aria-pressed={item.checked}
                className={cn(
                  "grid w-full grid-cols-[auto_1fr] items-center gap-4 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-secondary/55 focus-ring sm:p-5",
                  item.checked && "bg-secondary/35 text-muted-foreground"
                )}
                onClick={() => updateItem(item, { checked: !item.checked })}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md border border-primary/75 text-primary",
                    item.checked && "bg-primary text-primary-foreground"
                  )}
                  aria-hidden="true"
                >
                  {item.checked ? <Check className="size-5" /> : null}
                </span>
                <span className="min-w-0 space-y-1">
                  <span
                    data-testid="store-grocery-item-name"
                    className={cn("block text-lg font-semibold leading-tight", item.checked && "line-through")}
                  >
                    {formatGroceryItem(item)}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {item.pantryStaple ? <Badge variant="secondary">Pantry</Badge> : null}
                    {item.quantityNotes.length > 0 ? <span>Also added: {item.quantityNotes.join("; ")}</span> : null}
                  </span>
                </span>
              </button>
            ) : (
              <div key={item.id} className="grid gap-3 rounded-lg border bg-background p-3 lg:grid-cols-[auto_7rem_7rem_minmax(0,1fr)_auto] lg:items-start">
                <Checkbox checked={item.checked} onCheckedChange={(checked) => updateItem(item, { checked: Boolean(checked) })} aria-label={`Check ${item.displayName}`} />
                <Input
                  aria-label={`Quantity for ${item.displayName}`}
                  value={item.quantity}
                  onChange={(event) => updateItem(item, { quantity: event.target.value })}
                />
                <Input aria-label={`Unit for ${item.displayName}`} value={item.unit} onChange={(event) => updateItem(item, { unit: event.target.value })} />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="grocery-item-name"
                      className={cn(
                        "text-left font-medium hover:text-primary focus-ring",
                        item.checked && "text-muted-foreground line-through"
                      )}
                      onClick={() => updateItem(item, { checked: !item.checked })}
                    >
                      {item.displayName}
                    </button>
                    {item.pantryStaple ? <Badge variant="secondary">Pantry</Badge> : null}
                  </div>
                  {item.quantityNotes.length > 0 ? (
                    <p className="text-xs text-muted-foreground">Also added: {item.quantityNotes.join("; ")}</p>
                  ) : null}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => removeItem(item)}>
                  <Trash2 />
                  Remove
                </Button>
              </div>
            )
          )
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Add ingredients from a recipe or create a custom grocery item.
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-[2200px] space-y-5">
      <h1 className="sr-only">Groceries</h1>
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant={storeView ? "default" : "outline"}>
          <Link href={storeView ? "/groceries" : "/groceries?view=store"}>
            <ListChecks />
            {storeView ? "Edit view" : "Store view"}
          </Link>
        </Button>
        <Button type="button" variant="outline" onClick={() => copyText(fullListText, "full-list")} disabled={items.length === 0}>
          <Copy />
          {copied === "full-list" ? "Copied" : "Copy list"}
        </Button>
        {!storeView ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => copyText(buildWalmartCartAgentPrompt(items, profileId), "walmart-cart-prompt")}
            disabled={walmartItems.length === 0}
          >
            <ShoppingCart />
            {copied === "walmart-cart-prompt" ? "Copied" : "Copy Walmart cart prompt"}
          </Button>
        ) : null}
      </div>

      {message ? (
        <div className="rounded-lg border bg-secondary/45 p-3 text-sm" role="status">
          {message}
        </div>
      ) : null}

      {!storeView ? (
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
      ) : null}

      {storeChecklist}

      {!storeView && meatStoreGroups.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3 min-[1800px]:grid-cols-4" data-testid="meat-store-panels">
          {meatStoreGroups.map((group) => (
            <Card key={group.store}>
              <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>{group.label}</CardTitle>
                  <CardDescription>{group.items.length} meat items ready to source.</CardDescription>
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
      ) : null}
    </div>
  );
}
