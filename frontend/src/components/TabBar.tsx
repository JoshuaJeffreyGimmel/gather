import { useRouter } from '../router';

const TABS = [
  { label: 'Entdecken', path: '/' },
  { label: 'Treffen', path: '/meetups' },
  { label: 'Chats', path: '/chats' },
  { label: 'Profil', path: '/profile' }
] as const;

export function TabBar() {
  const { path, go } = useRouter();

  // A tab stays lit while you are inside one of its screens.
  const active = (tab: string) => {
    if (tab === '/') return path === '/';
    return path === tab || path.startsWith(tab + '/');
  };
  const discoverActive = path === '/' || path.startsWith('/a/');

  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      <button onClick={() => go('/')} aria-current={discoverActive ? 'page' : undefined}>
        <span className="tabbar__label">{TABS[0].label}</span>
        <span className="tabbar__dot" />
      </button>
      <button onClick={() => go('/meetups')} aria-current={active('/meetups') ? 'page' : undefined}>
        <span className="tabbar__label">{TABS[1].label}</span>
        <span className="tabbar__dot" />
      </button>
      <button onClick={() => go('/create')} aria-label="Aktivität erstellen" style={{ display: 'grid', placeItems: 'center' }}>
        <span className="tabbar__add" aria-hidden="true">+</span>
      </button>
      <button onClick={() => go('/chats')} aria-current={active('/chats') ? 'page' : undefined}>
        <span className="tabbar__label">{TABS[2].label}</span>
        <span className="tabbar__dot" />
      </button>
      <button
        onClick={() => go('/profile')}
        aria-current={active('/profile') || path === '/invite' ? 'page' : undefined}
      >
        <span className="tabbar__label">{TABS[3].label}</span>
        <span className="tabbar__dot" />
      </button>
    </nav>
  );
}
