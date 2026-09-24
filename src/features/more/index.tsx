import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Droplets, Gauge, Image, Ruler, Save, Settings } from 'lucide-react';
import { PageHeader } from '@/components/ui';

const ITEMS = [
  { to: '/coach', label: 'Coach and targets', icon: Gauge },
  { to: '/recipes', label: 'Recipes, meals and my foods', icon: BookOpen },
  { to: '/extras/measurements', label: 'Body measurements', icon: Ruler },
  { to: '/extras/photos', label: 'Progress photos', icon: Image },
  { to: '/extras/water', label: 'Water', icon: Droplets },
  { to: '/extras/backup', label: 'Export, import and backup', icon: Save },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <div className="overflow-hidden rounded-2xl bg-surface">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-0 hover:bg-surface-2">
            <Icon size={20} className="text-muted" />
            <span className="flex-1">{label}</span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        ))}
      </div>
    </>
  );
}
