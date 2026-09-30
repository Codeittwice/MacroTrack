import { useMemo, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, BookOpen, Bot, ChefHat, ChevronRight, Droplets, Dumbbell, Flame, Gauge, Image, Info, Palette, Pill, Ruler, Save, Scale, Search, Settings, Upload, User, UtensilsCrossed,
} from 'lucide-react';
import { Input, PageHeader } from '@/components/ui';

interface Item {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** extra words the search matches, e.g. "api key" for AI */
  keywords?: string;
}

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Body',
    items: [
      { to: '/weight', label: 'Weight log', icon: Scale, keywords: 'weigh in scale trend' },
      { to: '/extras/measurements', label: 'Body measurements', icon: Ruler, keywords: 'waist neck hips body fat' },
      { to: '/extras/photos', label: 'Progress photos', icon: Image, keywords: 'pictures' },
    ],
  },
  {
    title: 'Nutrition',
    items: [
      { to: '/recipes?view=preps', label: 'Meal preps and leftovers', icon: ChefHat, keywords: 'batch cooked portions left' },
      { to: '/recipes', label: 'Recipes, saved meals and my foods', icon: BookOpen, keywords: 'custom food' },
      { to: '/coach', label: 'Coach and targets', icon: Gauge, keywords: 'check-in expenditure tdee calories macros' },
      { to: '/extras/water', label: 'Water', icon: Droplets, keywords: 'drink hydration' },
      { to: '/settings#food-search', label: 'Food search and names', icon: UtensilsCrossed, keywords: 'english dutch language region open food facts' },
    ],
  },
  {
    title: 'Training and habits',
    items: [
      { to: '/training', label: 'Training', icon: Dumbbell, keywords: 'workout exercise sets muscles' },
      { to: '/supplements', label: 'Supplements', icon: Pill, keywords: 'creatine vitamins protein powder' },
      { to: '/settings#reminders', label: 'Reminders and notifications', icon: Bell, keywords: 'notify alarm' },
      { to: '/settings#exercise-calories', label: 'Exercise calories', icon: Flame, keywords: 'burn eat back' },
    ],
  },
  {
    title: 'Data',
    items: [
      { to: '/extras/backup', label: 'Backup and restore', icon: Save, keywords: 'export import phone pc' },
      { to: '/extras/backup', label: 'Import from MyFitnessPal or MacroFactor', icon: Upload, keywords: 'csv history' },
    ],
  },
  {
    title: 'App',
    items: [
      { to: '/settings#profile', label: 'Profile', icon: User, keywords: 'age height sex goal' },
      { to: '/settings#appearance', label: 'Appearance', icon: Palette, keywords: 'theme dark light accent colour purple' },
      { to: '/settings#ai', label: 'AI and voice', icon: Bot, keywords: 'api key claude openai gemini voice language' },
      { to: '/settings', label: 'All settings', icon: Settings, keywords: 'units meals' },
      { to: '/settings#about', label: 'About', icon: Info, keywords: 'version nevo credit' },
    ],
  },
];

function Row({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <Link to={item.to} className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-0 hover:bg-surface-2">
      <Icon size={20} className="text-muted" />
      <span className="flex-1">{item.label}</span>
      <ChevronRight size={18} className="text-muted" />
    </Link>
  );
}

export default function MorePage() {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return SECTIONS.flatMap((s) => s.items).filter((item) => `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <PageHeader title="More" />
      <label className="relative mb-5 block">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a page or setting" aria-label="Find a page or setting" className="pl-10" />
      </label>
      {matches ? (
        matches.length > 0
          ? <div className="overflow-hidden rounded-2xl bg-surface">{matches.map((item) => <Row key={item.label} item={item} />)}</div>
          : <p className="py-8 text-center text-sm text-muted">Nothing matches "{query}".</p>
      ) : (
        SECTIONS.map((section) => (
          <section key={section.title} className="mb-5" aria-label={section.title}>
            <h2 className="mb-1.5 px-1 text-xs font-medium tracking-wide text-muted uppercase">{section.title}</h2>
            <div className="overflow-hidden rounded-2xl bg-surface">{section.items.map((item) => <Row key={item.label} item={item} />)}</div>
          </section>
        ))
      )}
    </div>
  );
}
