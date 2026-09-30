import type { ComponentType } from 'react';
import { Camera, Mic, Plus, Scale } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

/** Round one-tap actions under the hero card. */
export function QuickActions({ meal }: { meal: number }) {
  const navigate = useNavigate();
  const actions: { label: string; aria: string; icon: ComponentType<{ size?: number }>; to: string; primary?: boolean }[] = [
    { label: 'Log food', aria: 'Log food', icon: Plus, to: `/log?add=${meal}`, primary: true },
    { label: 'Photo', aria: 'Photo', icon: Camera, to: `/log?add=${meal}&tab=photo` },
    { label: 'Describe', aria: 'Describe meal', icon: Mic, to: `/log?add=${meal}&tab=ai` },
    { label: 'Weight', aria: 'Log weight', icon: Scale, to: '/weight?log=1' },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {actions.map(({ label, aria, icon: Icon, to, primary }) => (
        <button key={label} type="button" aria-label={aria} onClick={() => navigate(to)} className="flex flex-col items-center gap-1.5 rounded-2xl py-1 text-xs text-muted outline-none hover:text-text focus-visible:text-text">
          <span className={clsx('flex h-12 w-12 items-center justify-center rounded-full', primary ? 'bg-primary text-on-primary' : 'bg-surface text-text')}>
            <Icon size={21} />
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}

export default QuickActions;
