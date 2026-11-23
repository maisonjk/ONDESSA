import { useEffect } from 'react';
import { StoreProvider, useStore, getState } from './lib/store';
import { useRoute, go, type Route } from './router';
import { Icon, ToastHost, toast, type IconName } from './ui/kit';
import { OverlayHost } from './ui/overlays';
import { scheduleInAppReminder } from './lib/reminders';
import { isoDate } from './lib/dates';
import { track } from './lib/analytics';
import { Home } from './screens/Home';
import { Renewal } from './screens/Renewal';
import { Library } from './screens/Library';
import { Companion } from './screens/Companion';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';
import { Journeys } from './screens/Journeys';
import { Onboarding } from './screens/Onboarding';

const TABS: { name: Route['name']; label: string; icon: IconName }[] = [
  { name: 'home', label: 'Today', icon: 'home' },
  { name: 'library', label: 'Library', icon: 'library' },
  { name: 'companion', label: 'Companion', icon: 'spark' },
  { name: 'progress', label: 'Journey', icon: 'chart' },
];

function Shell() {
  const raw = useRoute();
  const s = useStore();
  const onboarded = !!s.profile.onboardedAt;

  useEffect(() => { track('app_opened', { onboarded }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Post-checkout return from Stripe.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const c = q.get('checkout');
    if (!c) return;
    history.replaceState(null, '', location.pathname + location.hash);
    if (c === 'success') toast('Welcome to Premium. Your trial has started.');
  }, []);

  useEffect(() => scheduleInAppReminder(s.profile.reminder, () => getState().renewals.some((r) => r.date === isoDate())), [s.profile.reminder]);

  // First run: onboarding before anything else, but never force an account.
  const route: Route = !onboarded && raw.name !== 'renewal' ? { name: 'onboarding' } : raw;

  const flow = route.name === 'renewal' || route.name === 'onboarding';
  let screen;
  switch (route.name) {
    case 'renewal': screen = <Renewal key={location.hash} route={route} />; break;
    case 'library': screen = <Library />; break;
    case 'companion': screen = <Companion />; break;
    case 'progress': screen = <Progress />; break;
    case 'settings': screen = <Settings />; break;
    case 'journeys': screen = <Journeys />; break;
    case 'onboarding': screen = <Onboarding />; break;
    default: screen = <Home />;
  }

  return (
    <div className="shell">
      <main className={`app ${flow ? 'flow' : ''}`}>
        {screen}
        {!flow && (
          <nav className="tabbar" aria-label="Main">
            {TABS.map((t) => (
              <button key={t.name} className="tab" aria-current={route.name === t.name ? 'page' : undefined} onClick={() => go({ name: t.name } as Route)}>
                <Icon name={t.icon} size={24} />
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </main>
      <OverlayHost />
      <ToastHost />
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
