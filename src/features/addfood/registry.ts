/**
 * Extension point for Wave 3 Add-food tabs (Barcode/Open Food Facts, AI). Any feature can register
 * a tab at runtime; AddFoodSheet renders built-in tabs first, then registered ones sorted by
 * `order` (ties broken by registration order).
 */
import { useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import type { DateKey, FoodItem } from '@/db/types';

export interface AddFoodTabContext {
  date: DateKey;
  meal: number;
  onLogged(): void;
  openFood(food: FoodItem): void;
}

export interface AddFoodTab {
  id: string;
  label: string;
  icon?: ReactNode | ComponentType<{ size?: number }>;
  render: (ctx: AddFoodTabContext) => ReactNode;
  order?: number;
}

const tabs = new Map<string, AddFoodTab>();
const registrationOrder = new Map<string, number>();
let seq = 0;
let cache: AddFoodTab[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  cache = null;
  for (const l of listeners) l();
}

function sortedTabs(): AddFoodTab[] {
  if (cache) return cache;
  cache = [...tabs.values()].sort((a, b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return (registrationOrder.get(a.id) ?? 0) - (registrationOrder.get(b.id) ?? 0);
  });
  return cache;
}

/** Register (or replace, if the id already exists) an Add-food tab. Returns an unregister function. */
export function registerAddFoodTab(tab: AddFoodTab): () => void {
  tabs.set(tab.id, tab);
  registrationOrder.set(tab.id, seq++);
  notify();
  return () => unregisterAddFoodTab(tab.id);
}

export function unregisterAddFoodTab(id: string): void {
  if (!tabs.has(id)) return;
  tabs.delete(id);
  registrationOrder.delete(id);
  notify();
}

/** Subscribes to the registry so late registrations (e.g. lazy-loaded Wave 3 tabs) re-render. */
export function useAddFoodTabs(): AddFoodTab[] {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    sortedTabs,
    sortedTabs,
  );
}
