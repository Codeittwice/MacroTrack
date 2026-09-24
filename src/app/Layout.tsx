import { NavLink, Outlet } from 'react-router-dom';
import { ChartLine, Ellipsis, House, Scale, UtensilsCrossed } from 'lucide-react';
import clsx from 'clsx';

const TABS = [
  { to: '/', label: 'Dashboard', icon: House },
  { to: '/log', label: 'Food log', icon: UtensilsCrossed },
  { to: '/weight', label: 'Weight', icon: Scale },
  { to: '/progress', label: 'Progress', icon: ChartLine },
  { to: '/more', label: 'More', icon: Ellipsis },
];

export function Layout() {
  return (
    <div className="flex h-full">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2 text-lg font-semibold">
          <img src="/icon.svg" alt="" className="h-7 w-7" /> MacroTrack
        </div>
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm', isActive ? 'bg-surface-2 text-primary' : 'text-muted hover:text-text')
            }
          >
            <Icon size={20} /> {label}
          </NavLink>
        ))}
      </aside>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
        <div className="mx-auto w-full max-w-3xl px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pt-8">
          <Outlet />
        </div>
      </main>

      {/* Bottom tabs (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'text-primary' : 'text-muted')
            }
          >
            <Icon size={22} /> {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
