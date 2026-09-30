import { useEffect, useState } from 'react';
import { useSettings } from '@/app/hooks';
import { foodNames } from '@/lib/foods/names';
import { loadNevoEnglishNames } from '@/lib/food-sources/nevo';

/** English name for an older NEVO log entry that has no snapshot, looked up once from the bundled data. */
function useNevoEnglish(foodId: string | undefined, needed: boolean): string | undefined {
  const [name, setName] = useState<string>();
  useEffect(() => {
    if (!needed || !foodId?.startsWith('nevo:')) return;
    let active = true;
    void loadNevoEnglishNames().then((map) => { if (active) setName(map.get(foodId)); });
    return () => { active = false; };
  }, [foodId, needed]);
  return name;
}

/**
 * A food's name in the language chosen under Settings → Food names. In "both" mode the English name
 * comes first and the Dutch one sits underneath in a smaller line.
 */
export function FoodName({ item, className, as: Tag = 'span' }: {
  item: { name: string; nameEn?: string; id?: string; foodId?: string };
  className?: string;
  as?: 'span' | 'h3';
}) {
  const { foodNames: mode } = useSettings();
  const fallback = useNevoEnglish(item.foodId ?? item.id, !item.nameEn && mode !== 'nl');
  const { primary, secondary } = foodNames({ name: item.name, nameEn: item.nameEn ?? fallback }, mode);
  return (
    <span className="flex min-w-0 flex-col">
      <Tag className={className ?? 'truncate font-medium'}>{primary}</Tag>
      {secondary && <span lang="nl" className="truncate text-xs text-muted">{secondary}</span>}
    </span>
  );
}
