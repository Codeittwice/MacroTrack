import { Flame } from 'lucide-react';

export default function Welcome() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Flame size={32} />
      </div>
      <h1 className="text-3xl font-semibold">Welcome to MacroTrack</h1>
      <p className="max-w-xs text-muted">
        Track your weight and food, and get calorie and macro targets that adapt to you every week.
        Let's set up your profile — it only takes a minute.
      </p>
    </div>
  );
}
