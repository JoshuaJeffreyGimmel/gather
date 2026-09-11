import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useRouter } from '../router';
import { useSession } from '../session';
import type { Activity, Category } from '../types';
import { ActivityMap } from '../components/Map';
import { ActivityRow, CompactRow, FeaturedCard } from '../components/ActivityCards';
import { Avatar, EmptyState, SafetyNote, Segmented, StatusBar, Tick, TopFade } from '../components/Ui';

const CATEGORIES: Array<Category | 'Alle'> = ['Alle', 'Sport', 'Lernen', 'Kino', 'Gaming', 'Essen', 'Outdoor'];

export function Discover() {
  const { go } = useRouter();
  const { me, toastError } = useSession();
  const [view, setView] = useState<'liste' | 'karte'>('liste');
  const [category, setCategory] = useState<Category | 'Alle'>('Alle');
  const [all, setAll] = useState<Activity[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.activities()
      .then((r) => { if (alive) setAll(r.activities); })
      .catch((e) => { if (alive) toastError(e); });
    return () => { alive = false; };
  }, [toastError]);

  const visible = useMemo(
    () => (all ?? []).filter((a) => category === 'Alle' || a.category === category),
    [all, category]
  );

  // The board leads with the next thing you could still say yes to.
  const featured = useMemo(() => visible.find((a) => !a.isJoined && a.spotsFree > 0) ?? visible[0], [visible]);
  const rest = useMemo(() => visible.filter((a) => a.id !== featured?.id), [visible, featured]);

  const categoryCount = useMemo(() => new Set((all ?? []).map((a) => a.category)).size, [all]);
  const selectedActivity = useMemo(() => visible.find((a) => a.id === selected) ?? visible[0], [visible, selected]);

  return (
    <>
      <StatusBar />
      <TopFade />
      <div className="scroll" style={{ ['--pad-bottom' as string]: 'calc(var(--tabbar-h) + 16px)' }}>
        <header className="pad row row--between">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14.5, fontWeight: 650 }}>
            {me?.city ?? 'Zürich'} <span style={{ fontSize: 11, color: 'var(--muted)' }}>▾</span>
          </span>
          <div className="row" style={{ gap: 12 }}>
            <button onClick={() => go('/reminder')} aria-label="Erinnerungen" style={{ display: 'grid', placeItems: 'center' }}>
              <BellIcon />
            </button>
            <button onClick={() => go('/profile')} aria-label="Profil" style={{ position: 'relative', width: 36, height: 36 }}>
              <Avatar user={me} size={36} />
              {me?.verified && (
                <span style={{ position: 'absolute', right: -2, bottom: -2, boxShadow: '0 0 0 2px var(--cream)', borderRadius: '50%' }}>
                  <Tick size="sm" />
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="pad" style={{ paddingTop: 22 }}>
          <h1 className="display display--lg">Heute in deiner Nähe</h1>
          <p className="meta" style={{ marginTop: 7 }}>
            {all === null ? 'Wird geladen …' : `${all.length} ${all.length === 1 ? 'Aktivität' : 'Aktivitäten'} · ${categoryCount} ${categoryCount === 1 ? 'Kategorie' : 'Kategorien'} · bis 3 km`}
          </p>
        </div>

        <div className="pad" style={{ marginTop: 18 }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'liste', label: 'Liste' },
              { value: 'karte', label: 'Karte' }
            ]}
          />
        </div>

        <div className="hstack-scroll pad" style={{ marginTop: 16 }} role="group" aria-label="Kategorien">
          {CATEGORIES.map((c) => (
            <button key={c} className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>

        {all === null ? (
          <Loading />
        ) : view === 'liste' ? (
          <div className="pad" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {visible.length === 0 ? (
              <EmptyState
                title="Hier ist gerade nichts."
                body={`In der Kategorie ${category} läuft heute nichts. Starte doch selbst etwas.`}
                action={
                  <button className="btn btn--primary btn--sm" onClick={() => go('/create')}>
                    Aktivität erstellen
                  </button>
                }
              />
            ) : (
              <>
                {featured && <FeaturedCard activity={featured} onOpen={() => go(`/a/${featured.id}`)} />}
                {rest.map((a) => (
                  <ActivityRow key={a.id} activity={a} onOpen={() => go(`/a/${a.id}`)} />
                ))}
                <SafetyNote>
                  {visible.length === 1
                    ? 'Diese Aktivität wird von einem verifizierten Mitglied organisiert.'
                    : `Alle ${visible.length} Aktivitäten werden von verifizierten Mitgliedern organisiert.`}
                </SafetyNote>
              </>
            )}
          </div>
        ) : (
          <div className="pad" style={{ marginTop: 18 }}>
            <div style={{ position: 'relative', height: 372, borderRadius: 26, overflow: 'hidden', boxShadow: 'var(--card-edge-strong)' }}>
              <ActivityMap activities={visible} selectedId={selectedActivity?.id ?? null} onSelect={setSelected} />
            </div>
            {selectedActivity && (
              <div style={{ marginTop: 14 }}>
                <CompactRow activity={selectedActivity} onOpen={() => go(`/a/${selectedActivity.id}`)} />
              </div>
            )}
            <p className="meta" style={{ margin: '12px 2px 0', fontSize: 11.5, lineHeight: 1.45 }}>
              Treffpunkte sind erst nach der Zusage exakt sichtbar – vorher nur der Kreis.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5a5.5 5.5 0 0 0-5.5 5.5v3.2c0 .5-.18.98-.5 1.36L4.7 15.1a.7.7 0 0 0 .54 1.15h13.52a.7.7 0 0 0 .54-1.15l-1.3-1.54a2.12 2.12 0 0 1-.5-1.36V9A5.5 5.5 0 0 0 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Loading() {
  return (
    <div className="pad" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="skeleton" style={{ height: 224, borderRadius: 26 }} />
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton" style={{ height: 116, borderRadius: 22 }} />
      ))}
    </div>
  );
}
