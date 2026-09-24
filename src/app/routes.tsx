/** Integrator-owned. Each feature exports its page from features/<name>/index.tsx. */
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './Layout';
import { useProfile } from './hooks';

const Dashboard = lazy(() => import('@/features/dashboard'));
const FoodLog = lazy(() => import('@/features/foodlog'));
const Weight = lazy(() => import('@/features/weight'));
const Progress = lazy(() => import('@/features/progress'));
const More = lazy(() => import('@/features/more'));
const Settings = lazy(() => import('@/features/settings'));
const Onboarding = lazy(() => import('@/features/onboarding'));
const Coach = lazy(() => import('@/features/coach'));
const Recipes = lazy(() => import('@/features/recipes'));
const Extras = lazy(() => import('@/features/extras'));

function OnboardingGate({ children }: { children: ReactNode }) {
  const profile = useProfile();
  const loc = useLocation();
  if (profile === undefined) return null;
  if (profile === null && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

const page = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

export const router = createBrowserRouter([
  { path: '/onboarding', element: page(<Onboarding />) },
  {
    element: <OnboardingGate><Layout /></OnboardingGate>,
    children: [
      { path: '/', element: page(<Dashboard />) },
      { path: '/log', element: page(<FoodLog />) },
      { path: '/log/:date', element: page(<FoodLog />) },
      { path: '/weight', element: page(<Weight />) },
      { path: '/progress', element: page(<Progress />) },
      { path: '/more', element: page(<More />) },
      { path: '/settings', element: page(<Settings />) },
      { path: '/coach', element: page(<Coach />) },
      { path: '/recipes', element: page(<Recipes />) },
      { path: '/extras/*', element: page(<Extras />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
