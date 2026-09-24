import { useNavigate } from 'react-router-dom';
import { Card, Button } from '@/components/ui';

export function CheckInBanner({ visible }: { visible: boolean }) {
  const navigate = useNavigate();
  if (!visible) return null;

  return (
    <Card className="border border-[var(--primary)]/30 bg-[var(--primary)]/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Weekly check-in ready</div>
          <div className="text-sm text-muted">Review your trend and update your targets.</div>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate('/coach')}>
          Check in
        </Button>
      </div>
    </Card>
  );
}

export default CheckInBanner;
