import { Plus, Scale, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';

export function QuickActions({ meal }: { meal: number }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" onClick={() => navigate(`/log?add=${meal}`)}>
        <Plus size={16} /> Log food
      </Button>
      <Button variant="secondary" onClick={() => navigate(`/log?add=${meal}&tab=ai`)}>
        <Sparkles size={16} /> Describe meal
      </Button>
      <Button variant="ghost" onClick={() => navigate('/weight?log=1')}>
        <Scale size={16} /> Log weight
      </Button>
    </div>
  );
}

export default QuickActions;
