import { useEffect } from 'react';
import { match, useRouter } from './router';
import { useSession } from './session';
import { TabBar } from './components/TabBar';
import { Tick } from './components/Ui';
import { Onboarding } from './screens/Onboarding';
import { Discover } from './screens/Discover';
import { ActivityDetail } from './screens/ActivityDetail';
import { CreateActivity } from './screens/CreateActivity';
import { MeetupsScreen } from './screens/Meetups';
import { Chats } from './screens/Chats';
import { Chat } from './screens/Chat';
import { Profile } from './screens/Profile';
import { Invite } from './screens/Invite';
import { Reminder } from './screens/Reminder';

/** Screens that are pushed on top of a tab and hide the tab bar. */
const FULLSCREEN = ['/create', '/reminder'];

export function App() {
  const { path, replace } = useRouter();
  const { status, me, toasts } = useSession();

  // A shared invite link (/?ref=CODE) is kept until after sign-up.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      try { sessionStorage.setItem('gather.ref', ref); } catch { /* ignore */ }
    }
  }, []);

  const chat = match('/chats/:id', path);
  const detail = match('/a/:id', path);

  let screen: React.ReactNode;
  let chrome = true;

  if (status === 'loading') {
    screen = <Booting />;
    chrome = false;
  } else if (status === 'anonymous') {
    screen = <Onboarding />;
    chrome = false;
  } else if (detail) {
    // Pushed on top of a tab: its own sticky decision bar owns the bottom edge.
    screen = <ActivityDetail id={detail.id} />;
    chrome = false;
  } else if (chat) {
    screen = <Chat id={chat.id} />;
  } else if (path === '/meetups') {
    screen = <MeetupsScreen />;
  } else if (path === '/chats') {
    screen = <Chats />;
  } else if (path === '/profile') {
    screen = <Profile />;
  } else if (path === '/invite') {
    screen = <Invite />;
  } else if (path === '/create') {
    screen = <CreateActivity />;
    chrome = false;
  } else if (path === '/reminder') {
    screen = <Reminder />;
    chrome = false;
  } else if (path === '/') {
    screen = <Discover />;
  } else {
    screen = <NotFound />;
  }

  // An unknown deep link lands on the board rather than a dead end.
  useEffect(() => {
    if (status !== 'signed-in') return;
    const known =
      path === '/' ||
      detail ||
      chat ||
      ['/meetups', '/chats', '/profile', '/invite', ...FULLSCREEN].includes(path);
    if (!known) replace('/');
  }, [path, status, detail, chat, replace]);

  // Scroll each newly pushed screen back to the top.
  useEffect(() => {
    document.querySelector('.scroll')?.scrollTo({ top: 0 });
  }, [path]);

  return (
    <div className="app">
      <div className="device">
        <div
          className="device__screen"
          key={status === 'signed-in' ? 'app' : status}
          style={chrome ? undefined : ({ ['--toast-bottom' as string]: '112px' } as React.CSSProperties)}
        >
          {screen}
          {chrome && me && <TabBar />}
          {toasts.map((t) => (
            <div key={t.id} className={`toast${t.tone === 'error' ? ' toast--error' : ''}`} role="status">
              {t.tone === 'ok' && <Tick size="sm" />}
              <span>{t.text}</span>
            </div>
          ))}
        </div>
        <span className="notch" aria-hidden="true" />
      </div>
    </div>
  );
}

function Booting() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--cream)' }}>
      <div className="col" style={{ alignItems: 'center', gap: 14 }}>
        <img src="/icons/icon-192.png" alt="Gather" width={64} height={64} style={{ borderRadius: 18 }} />
        <span className="label">Finden · Planen · Treffen</span>
      </div>
    </div>
  );
}

function NotFound() {
  const { go } = useRouter();
  return (
    <div className="scroll pad" style={{ display: 'grid', placeItems: 'center' }}>
      <div className="col center" style={{ gap: 12 }}>
        <h1 className="display display--lg">Diese Seite gibt es nicht.</h1>
        <button className="btn btn--primary btn--sm" onClick={() => go('/')}>
          Zum Entdecken
        </button>
      </div>
    </div>
  );
}
