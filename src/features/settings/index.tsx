import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/ui';
import { useProfile } from '@/app/hooks';
import { ProfileSection } from './ProfileSection';
import { TargetsSection } from './TargetsSection';
import { AppearanceSection } from './AppearanceSection';
import { ExerciseCaloriesSection } from './ExerciseCaloriesSection';
import { FoodSearchSection } from './FoodSearchSection';
import { UnitsSection } from './UnitsSection';
import { MealsSection } from './MealsSection';
import { WaterSection } from './WaterSection';
import { RemindersSection } from './RemindersSection';
import { AiSection } from './AiSection';
import { AboutSection } from './AboutSection';
import { DangerZone } from './DangerZone';

export default function SettingsPage() {
  const profile = useProfile();
  const { hash } = useLocation();

  // Deep links from More (e.g. /settings#ai) scroll to that section once it has rendered.
  useEffect(() => {
    if (!hash || profile === undefined) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash, profile]);

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <PageHeader title="Settings" />

      {profile === undefined && <p className="py-10 text-center text-muted">Loading…</p>}
      {profile === null && <p className="py-10 text-center text-muted">Finish onboarding to set up your profile.</p>}
      {profile && (
        <>
          <ProfileSection profile={profile} />
          <TargetsSection profile={profile} />
        </>
      )}

      <FoodSearchSection />
      <ExerciseCaloriesSection />
      <AppearanceSection />
      <UnitsSection />
      <MealsSection />
      <WaterSection />
      <RemindersSection />
      <AiSection />
      <AboutSection />
      <DangerZone />
    </div>
  );
}
