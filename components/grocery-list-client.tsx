"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  restoreGroceryItems,
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
import type { GroceryItemSuggestion } from "@/lib/grocery-suggestions";
import { cn } from "@/lib/utils";

type UndoClearAction = {
  items: GroceryListItem[];
  message: string;
};

export function GroceryListClient() {
  const searchParams = useSearchParams();
  const { selectedProfile } = useRecipeProfile();
  const [items, setItems] = useState<GroceryListItem[]>([]);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");
  const [customName, setCustomName] = useState("");
  const [customQuantity, setCustomQuantity] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [customSuggestions, setCustomSuggestions] = useState<GroceryItemSuggestion[]>([]);
  const [customSuggestionsOpen, setCustomSuggestionsOpen] = useState(false);
  const [undoClearAction, setUndoClearAction] = useState<UndoClearAction | undefined>();
  const customFormRef = useRef<HTMLFormElement>(null);

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
    setUndoClearAction(undefined);
  }, [refreshItems, selectedProfile.id]);

  useEffect(() => {
    function refreshFromCloud() {
      refreshItems(selectedProfile.id);
    }

    window.addEventListener(CLOUD_DATA_LOADED_EVENT, refreshFromCloud);
    return () => window.removeEventListener(CLOUD_DATA_LOADED_EVENT, refreshFromCloud);
  }, [refreshItems, selectedProfile.id]);

  useEffect(() => {
    const trimmed = customName.trim();
    let ignore = false;

    if (storeView || trimmed.length < 2) {
      setCustomSuggestions([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const { suggestGroceryItems } = await import("@/lib/grocery-suggestions");
      if (ignore) return;
      setCustomSuggestions(suggestGroceryItems(trimmed, items));
    }, 100);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [customName, items, storeView]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!customFormRef.current?.contains(event.target as Node)) setCustomSuggestionsOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

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

  function chooseCustomSuggestion(suggestion: GroceryItemSuggestion) {
    setCustomName(suggestion.displayName);
    setCustomQuantity(suggestion.quantity);
    setCustomUnit(suggestion.unit);
    setCustomSuggestionsOpen(false);
  }

  function submitCustomItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = customName.trim();
    const quantity = customQuantity;
    const unit = customUnit;
    if (!displayName) return;
    const result = addCustomGroceryItem({ displayName, quantity, unit }, profileId);
    refreshItems(profileId);
    setCustomName("");
    setCustomQuantity("");
    setCustomUnit("");
    setCustomSuggestions([]);
    setCustomSuggestionsOpen(false);
    setUndoClearAction(undefined);
    setMessage(result.added ? "Added custom grocery item." : "Updated matching grocery item.");
  }

  function clearChecked() {
    const removedItems = items.filter((item) => item.checked);
    if (removedItems.length === 0) return;
    clearCheckedGroceryItems(profileId);
    refreshItems(profileId);
    setUndoClearAction({
      items: removedItems,
      message: `${removedItems.length} checked ${removedItems.length === 1 ? "item" : "items"} cleared.`
    });
    setMessage("");
  }

  function clearAll() {
    if (items.length === 0) return;
    const removedItems = items;
    clearGroceryItemsForProfile(profileId);
    refreshItems(profileId);
    setUndoClearAction({
      items: removedItems,
      message: `${removedItems.length} grocery ${removedItems.length === 1 ? "item" : "items"} cleared.`
    });
    setMessage("");
  }

  function undoClear(action: UndoClearAction) {
    restoreGroceryItems(action.items);
    refreshItems(profileId);
    setUndoClearAction(undefined);
    setMessage(`${action.items.length} ${action.items.length === 1 ? "item" : "items"} restored.`);
  }

  function itemAmount(item: GroceryListItem) {
    return [item.quantity, item.unit].map((value) => value.trim()).filter(Boolean).join(" ");
  }

  const storeChecklist = (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:p-6">
        <div>
          <CardTitle className={storeView ? "" : "sr-only"}>{storeView ? "Store checklist" : "Shopping list"}</CardTitle>
          <CardDescription>{items.length} items</CardDescription>
        </div>
        {!storeView ? (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-w-0"
              onClick={clearChecked}
              disabled={!items.some((item) => item.checked)}
            >
              Clear checked
            </Button>
            <Button type="button" variant="outline" size="sm" className="min-w-0" onClick={clearAll} disabled={items.length === 0}>
              Clear all
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
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
              <div
                key={item.id}
                data-testid="grocery-edit-row"
                className={cn("rounded-lg border bg-background", item.checked && "bg-secondary/25")}
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 md:hidden">
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={(checked) => updateItem(item, { checked: Boolean(checked) })}
                    aria-label={`Check ${item.displayName}`}
                  />
                  <div className="min-w-0">
                    <button
                      type="button"
                      data-testid="grocery-item-name"
                      className={cn(
                        "block min-w-0 text-left text-base font-semibold leading-tight hover:text-primary focus-ring",
                        item.checked && "text-muted-foreground line-through"
                      )}
                      onClick={() => updateItem(item, { checked: !item.checked })}
                    >
                      {item.displayName}
                    </button>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {itemAmount(item) ? <span data-testid="grocery-item-amount">{itemAmount(item)}</span> : null}
                      {item.pantryStaple ? <Badge variant="secondary">Pantry</Badge> : null}
                      {item.quantityNotes.length > 0 ? <span className="min-w-0 break-words">Also added: {item.quantityNotes.join("; ")}</span> : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(item)}
                  >
                    <Trash2 />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>

                <div className="hidden gap-3 p-3 md:grid md:grid-cols-[auto_7rem_7rem_minmax(0,1fr)_auto] md:items-start lg:p-4">
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={(checked) => updateItem(item, { checked: Boolean(checked) })}
                    aria-label={`Check ${item.displayName}`}
                  />
                  <Input
                    aria-label={`Quantity for ${item.displayName}`}
                    value={item.quantity}
                    onChange={(event) => updateItem(item, { quantity: event.target.value })}
                    className="min-w-0"
                  />
                  <Input
                    aria-label={`Unit for ${item.displayName}`}
                    value={item.unit}
                    onChange={(event) => updateItem(item, { unit: event.target.value })}
                    className="min-w-0"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        data-testid="grocery-item-name"
                        className={cn("min-w-0 text-left font-medium hover:text-primary focus-ring", item.checked && "text-muted-foreground line-through")}
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
    <div className="mx-auto max-w-[2200px] space-y-4 sm:space-y-5">
      <h1 className="sr-only">Groceries</h1>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
        <Button asChild variant={storeView ? "default" : "outline"} className="min-w-0">
          <Link href={storeView ? "/groceries" : "/groceries?view=store"}>
            <ListChecks />
            {storeView ? "Edit view" : "Store view"}
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-w-0"
          onClick={() => copyText(fullListText, "full-list")}
          disabled={items.length === 0}
        >
          <Copy />
          {copied === "full-list" ? "Copied" : "Copy list"}
        </Button>
        {!storeView ? (
          <Button
            type="button"
            variant="outline"
            className="col-span-2 min-w-0 sm:col-span-1"
            onClick={() => copyText(buildWalmartCartAgentPrompt(items, profileId), "walmart-cart-prompt")}
            disabled={walmartItems.length === 0}
          >
            <ShoppingCart />
            {copied === "walmart-cart-prompt" ? "Copied" : "Copy Walmart cart prompt"}
          </Button>
        ) : null}
      </div>

      {undoClearAction ? (
        <div
          className="flex flex-col gap-3 rounded-lg border bg-secondary/45 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <span>{undoClearAction.message}</span>
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => undoClear(undoClearAction)}>
            Undo
          </Button>
        </div>
      ) : message ? (
        <div className="rounded-lg border bg-secondary/45 p-3 text-sm" role="status">
          {message}
        </div>
      ) : null}

      {!storeView ? (
        <Card className="overflow-visible">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Add custom item</CardTitle>
            <CardDescription>Add anything that is not already coming from a recipe.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <form
              ref={customFormRef}
              aria-label="Add custom grocery item"
              className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto]"
              onSubmit={submitCustomItem}
            >
              <div className="relative col-span-2 min-w-0 sm:col-span-1">
                <Input
                  aria-label="Custom grocery item"
                  name="customName"
                  value={customName}
                  onChange={(event) => {
                    setCustomName(event.target.value);
                    setCustomSuggestionsOpen(true);
                  }}
                  onFocus={() => setCustomSuggestionsOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setCustomSuggestionsOpen(false);
                  }}
                  placeholder="Apples"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={customSuggestionsOpen && customSuggestions.length > 0}
                  aria-controls="custom-grocery-suggestions"
                  required
                />
                {customSuggestionsOpen && customSuggestions.length > 0 ? (
                  <div
                    id="custom-grocery-suggestions"
                    role="listbox"
                    aria-label="Custom grocery item suggestions"
                    className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
                  >
                    {customSuggestions.map((suggestion) => {
                      const amount = [suggestion.quantity, suggestion.unit].filter(Boolean).join(" ");
                      return (
                        <button
                          key={suggestion.id}
                          type="button"
                          role="option"
                          aria-selected="false"
                          className="grid w-full gap-1 px-3 py-2 text-left text-sm hover:bg-secondary focus-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => chooseCustomSuggestion(suggestion)}
                        >
                          <span className="line-clamp-1 font-medium">{suggestion.displayName}</span>
                          <span className="text-xs text-muted-foreground">
                            {amount || (suggestion.source === "current-list" ? "On list" : "Catalog")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <Input
                aria-label="Custom grocery quantity"
                name="customQuantity"
                value={customQuantity}
                onChange={(event) => setCustomQuantity(event.target.value)}
                placeholder="4"
                autoComplete="off"
              />
              <Input
                aria-label="Custom grocery unit"
                name="customUnit"
                value={customUnit}
                onChange={(event) => setCustomUnit(event.target.value)}
                placeholder="items"
                autoComplete="off"
              />
              <Button type="submit" className="col-span-2 w-full sm:col-span-1 sm:w-auto">
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
