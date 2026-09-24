/** Live-query hooks over the stored-foods library. */
import { useLiveQuery } from 'dexie-react-hooks';
import type { FoodItem } from '@/db/types';
import { getCustomFoods, getFavoriteFoods, getFrequentFoods, getRecentFoods, isFavorite } from './foods';

export function useRecentFoods(limit = 20): FoodItem[] | undefined {
  return useLiveQuery(() => getRecentFoods(limit), [limit]);
}

export function useFrequentFoods(limit = 20): FoodItem[] | undefined {
  return useLiveQuery(() => getFrequentFoods(limit), [limit]);
}

export function useFavoriteFoods(): FoodItem[] | undefined {
  return useLiveQuery(() => getFavoriteFoods(), []);
}

export function useCustomFoods(): FoodItem[] | undefined {
  return useLiveQuery(() => getCustomFoods(), []);
}

export function useIsFavorite(id: string | undefined): boolean {
  const result = useLiveQuery(() => (id ? isFavorite(id) : Promise.resolve(false)), [id]);
  return result ?? false;
}
