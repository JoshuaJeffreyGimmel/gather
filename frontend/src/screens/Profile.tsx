import { useEffect, useState } from 'react';
import { api } from '../api';
import { monthYear, relativeDay } from '../format';
import { useRouter } from '../router';
import { useSession } from '../session';
import type { Meetups } from '../types';
import { Avatar, StatusBar, Tick, TopFade } from '../components/Ui';

export function Profile() {
  const { go } = useRouter();
  const { me, setMe, signOut, toast, toastError } = useSession();
  const [data, setData] = useState<Meetups | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function verify() {
    setVerifying(true);
    try {
      // Same mock as the onboarding scan — the pause is what sells it.
      await new Promise((r) => window.setTimeout(r, 1400));
      const { user } = await api.verifyId();
      setMe(user);
      toast('Du bist verifiziert');
    } catch (e) {
      toastError(e);
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    let alive = true;
    api.meetups()
      .then((r) => { if (alive) setData(r); })
      .catch((e) => { if (alive) toastError(e); });
    return () => { alive = false; };
  }, [toastError]);

  if (!me) return null;

  const history = data ? [...data.upcoming, ...data.past].slice(0, 4) : [];

  return (
    <>
      <StatusBar />
      <TopFade />
      <div className="scroll" style={{ ['--pad-bottom' as string]: 'calc(var(--tabbar-h) + 16px)' }}>
        <div className="pad row row--between">
          <span style={{ fontSize: 14, fontWeight: 650 }}>Profil</span>
          <button style={{ fontSize: 12.5, color: 'var(--muted)' }} onClick={() => void signOut()}>
            Abmelden
          </button>
        </div>

        <div className="pad col" style={{ paddingTop: 26, alignItems: 'center', textAlign: 'center' }}>
          <div
            style={{
              position: 'relative',
              width: 112,
              height: 112,
              borderRadius: '50%',
              background: 'var(--grad)',
              display: 'grid',
              placeItems: 'center'
            }}
          >
            <Avatar user={me} size={100} style={{ boxShadow: '0 0 0 4px var(--cream)' }} />
            {me.verified && (
              <span
                style={{
                  position: 'absolute',
                  right: -2,
                  bottom: 2,
                  display: 'grid',
                  placeItems: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--ink)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 800,
                  lineHeight: 1,
                  boxShadow: '0 0 0 3px var(--cream)'
                }}
              >
                ✓
              </span>
            )}
          </div>

          <h1 className="display display--md" style={{ marginTop: 16 }}>
            {me.name}
            {me.age ? `, ${me.age}` : ''}
          </h1>
          <p className="meta" style={{ marginTop: 5 }}>
            {me.city} · dabei seit {monthYear(me.createdAt)}
          </p>

          <span
            style={{
              marginTop: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px 8px 8px',
              borderRadius: 999,
              background: 'var(--ink)',
              color: 'var(--cream)',
              fontSize: 12.5,
              fontWeight: 650
            }}
          >
            <Tick size="md" />
            {me.verified ? 'Verifiziert · Handynummer + Ausweis' : 'Noch nicht verifiziert'}
          </span>
        </div>

        <div className="pad" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
          <Stat value={String(me.stats.meetupsJoined)} label="Treffen" />
          <Stat value={String(me.stats.meetupsOrganized)} label="Organisiert" />
          <Stat value={`${me.stats.showUpRate} %`} label="Erschienen" dark />
        </div>

        <div className="pad" style={{ marginTop: 24 }}>
          <span className="label">Deine Aktivitäten</span>
          <div className="card card--clip" style={{ marginTop: 11 }}>
            {history.length === 0 ? (
              <p className="meta" style={{ padding: '18px 16px', fontSize: 13 }}>
                Noch nichts. Sag bei etwas zu – es taucht hier auf.
              </p>
            ) : (
              history.map((a, i) => (
                <div key={a.id}>
                  {i > 0 && <div className="card__divider" style={{ margin: '0 16px' }} />}
                  <button
                    onClick={() => go(`/a/${a.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', width: '100%', textAlign: 'left' }}
                  >
                    <span className="datetile" style={{ width: 38, height: 38, borderRadius: 12, fontSize: 15 }} aria-hidden="true">
                      {new Date(a.startTime).getDate()}
                    </span>
                    <span className="grow col" style={{ gap: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }} className="truncate">{a.title}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {a.category} · {relativeDay(a.startTime)} · {a.isOrganizer ? 'organisiert' : 'zugesagt'}
                      </span>
                    </span>
                    {a.isPast ? (
                      a.ratingAvg != null ? (
                        <span style={{ fontSize: 11.5, color: 'var(--muted)', flex: 'none' }}>★ {a.ratingAvg.toFixed(1)}</span>
                      ) : (
                        <span style={{ fontSize: 11.5, color: 'var(--faint)', flex: 'none' }}>ohne Bewertung</span>
                      )
                    ) : (
                      <Tick size="sm" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pad" style={{ marginTop: 18 }}>
          <div className="card card--clip">
            <SettingRow
              title="Sicherheit & Verifizierung"
              trailing={verifying ? 'Wird geprüft …' : me.verified ? 'Geprüft' : 'Jetzt verifizieren'}
              accent={!me.verified}
              onClick={me.verified || verifying ? undefined : verify}
            />
            <div className="card__divider" style={{ margin: '0 16px' }} />
            <SettingRow title="Gather+" trailing="CHF 4.90 / Mt." />
            <div className="card__divider" style={{ margin: '0 16px' }} />
            <SettingRow title="Freunde einladen" trailing="1 Monat gratis" accent onClick={() => go('/invite')} />
            <div className="card__divider" style={{ margin: '0 16px' }} />
            <SettingRow title="Einstellungen" />
          </div>
        </div>

        <p className="pad center meta" style={{ marginTop: 20, fontSize: 11 }}>
          Angemeldet als {me.phone}
        </p>
      </div>
    </>
  );
}

function Stat({ value, label, dark = false }: { value: string; label: string; dark?: boolean }) {
  return (
    <div
      style={{
        padding: '16px 12px',
        borderRadius: 20,
        background: dark ? 'var(--ink)' : 'var(--paper)',
        boxShadow: dark ? 'none' : 'var(--card-edge)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        alignItems: 'center'
      }}
    >
      <span style={{ fontFamily: 'var(--serif)', fontSize: 28, lineHeight: 1, color: dark ? 'var(--cream)' : 'var(--ink)' }}>
        {value}
      </span>
      <span style={{ fontSize: 10.5, color: dark ? 'var(--dim)' : 'var(--muted)', textAlign: 'center' }}>{label}</span>
    </div>
  );
}

function SettingRow({
  title,
  trailing,
  accent = false,
  onClick
}: {
  title: string;
  trailing?: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', width: '100%', textAlign: 'left', opacity: onClick ? 1 : 0.85 }}
    >
      <span className="grow" style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
      {trailing && (
        <span style={{ fontSize: 11.5, color: accent ? 'var(--red)' : 'var(--muted)', fontWeight: accent ? 650 : 400 }}>
          {trailing}
        </span>
      )}
      <span style={{ fontSize: 15, color: 'var(--faint)' }}>›</span>
    </button>
  );
}
