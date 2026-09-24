import { PageHeader } from '@/components/ui';
import { useProfile } from '@/app/hooks';
import { ProfileSection } from './ProfileSection';
import { TargetsSection } from './TargetsSection';
import { AppearanceSection } from './AppearanceSection';
import { UnitsSection } from './UnitsSection';
import { MealsSection } from './MealsSection';
import { WaterSection } from './WaterSection';
import { AiSection } from './AiSection';
import { AboutSection } from './AboutSection';
import { DangerZone } from './DangerZone';

export default function SettingsPage() {
  const profile = useProfile();

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

      <AppearanceSection />
      <UnitsSection />
      <MealsSection />
      <WaterSection />
      <AiSection />
      <AboutSection />
      <DangerZone />
    </div>
  );
}
