import { Component, useEffect, type ReactNode } from 'react';
import { upcomingReminders } from '../engine';
import { AppShell, Calendar, Home, LogDay } from '../screens/app-core';
import { Fertility, Insights, Membership, More, PregnancyView, PrivacyCenter, Settings } from '../screens/app-more';
import { LockScreen, Onboarding, Unavailable } from '../screens/onboarding';
import {
  ArticlePage, ArticleView, Deleted, Help, Landing, Legal, LibraryIndex, LibraryList, Plans, PrivacyPolicy,
} from '../screens/public';
import { navigate, usePath } from './router';
import { isNative } from '../platform';
import { useStore } from './store';

export function App() {
  return (
    <ErrorBoundary>
      <Routes />
    </ErrorBoundary>
  );
}

function Routes() {
  const path = usePath();
  const store = useStore();
  const { phase, data, entitlement, tour, exitTour } = store;
  useOpenNotification();

  // The tour lives only inside the app screens; leaving them ends it, so nothing that
  // writes to storage (setup, restore, delete) can ever run on sample data.
  useEffect(() => {
    if (tour && !path.startsWith('/app')) exitTour();
  }, [tour, path, exitTour]);

  if (phase === 'loading') return <div className="lock-screen" aria-busy="true" />;
  if (phase === 'unavailable' && !tour) return <Unavailable message={store.storageError} />;
  if (phase === 'locked' && !tour) return <LockScreen />;

  // The store apps open straight into the product: no marketing page, no website navigation.
  if (isNative && (path === '/' || path === '/library')) return <Redirect to={path === '/library' ? '/app/library' : data ? '/app' : '/start'} />;
  if (isNative && path.startsWith('/library/')) return <Redirect to={`/app${path}`} />;
  if (path === '/') return <Landing />;
  if (path === '/plans') return <Plans />;
  if (path === '/library') return <LibraryIndex />;
  if (path.startsWith('/library/')) return <ArticlePage slug={path.slice(9)} />;
  if (path === '/legal') return <Legal />;
  if (path === '/help') return <Help />;
  if (path === '/privacy') return <PrivacyPolicy />;
  if (path === '/deleted' || path === '/deleted-unverified') return <Deleted verified={path === '/deleted'} />;
  if (path === '/start') return data && !tour ? <Redirect to="/app" /> : <Onboarding />;

  if (path.startsWith('/app')) {
    if (!tour) {
      if (!data) return <Redirect to="/start" />;
      if (entitlement.status === 'loading') return <div className="lock-screen" aria-busy="true" />;
      if (entitlement.status !== 'active') return <Redirect to="/plans" />;
    }
    return <AppShell path={path}>{appScreen(path)}</AppShell>;
  }
  return <Redirect to="/" />;
}

function appScreen(path: string) {
  if (path.startsWith('/app/library/')) return <ArticleView slug={path.slice(13)} base="/app/library" />;
  switch (path) {
    case '/app': return <Home />;
    case '/app/calendar': return <Calendar />;
    case '/app/log': return <LogDay />;
    case '/app/fertility': return <Fertility />;
    case '/app/pregnancy': return <PregnancyView />;
    case '/app/insights': return <Insights />;
    case '/app/more': return <More />;
    case '/app/settings': return <Settings />;
    case '/app/privacy': return <PrivacyCenter />;
    case '/app/library': return <LibraryList base="/app/library" />;
    case '/app/membership': return <Membership />;
    default: return <Home />;
  }
}

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, true), [to]);
  return null;
}

/**
 * Web reminders: on open, show at most one local notification per day for reminders due
 * today. Text comes from the discreet-aware reminder engine; no payload leaves the device.
 */
function useOpenNotification() {
  const { data, forecast, today, tour, phase } = useStore();
  useEffect(() => {
    if (isNative || tour || phase !== 'ready' || !data || !forecast) return; // native schedules real notifications
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      if (localStorage.getItem('ondessa.lastNotice') === today) return;
      const due = upcomingReminders(data, forecast, today, 0);
      if (!due.length) return;
      new Notification('Ondessa', { body: due[0]!.notification, tag: 'ondessa-daily' });
      localStorage.setItem('ondessa.lastNotice', today);
    } catch {
      /* notifications or storage unavailable */
    }
  }, [data, forecast, today, tour, phase]);
}

/** Any rendering error shows a recovery screen instead of a blank page. Data is untouched. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="lock-screen">
        <div className="card stack" style={{ '--gap': '14px', maxWidth: 440 } as React.CSSProperties} role="alert">
          <h2>Something went wrong</h2>
          <p className="muted">Ondessa hit an unexpected problem showing this screen. Your data has not been changed.</p>
          <div className="row wrap-row">
            <button className="btn" onClick={() => window.location.reload()}>Reload</button>
            <button className="btn secondary" onClick={() => { window.location.hash = '#/app'; window.location.reload(); }}>Go to Today</button>
          </div>
        </div>
      </div>
    );
  }
}
