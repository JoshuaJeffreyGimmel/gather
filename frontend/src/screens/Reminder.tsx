import { useEffect, useState } from 'react';
import { api } from '../api';
import { ago, countdown, longDate } from '../format';
import { useRouter } from '../router';
import { useSession } from '../session';
import type { Meetups } from '../types';
import { StatusBar, Tick } from '../components/Ui';

/**
 * The lock screen an hour before the meetup — the moment plans usually die.
 * Reached from the bell in the Discover header.
 */
export function Reminder() {
  const { back, go } = useRouter();
  const { toastError } = useSession();
  const [data, setData] = useState<Meetups | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    api.meetups()
      .then((r) => { if (alive) setData(r); })
      .catch((e) => { if (alive) toastError(e); });
    return () => { alive = false; };
  }, [toastError]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 20000);
    return () => window.clearInterval(t);
  }, []);

  const next = data?.next ?? null;
  // The newest person to say yes — the second, quieter notification.
  const newest = next
    ? [...next.participants].sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())[0]
    : null;

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <>
      <StatusBar light />
      <button
        onClick={back}
        aria-label="Zurück"
        style={{ position: 'absolute', inset: 0, background: 'var(--ink-deep)', cursor: 'default' }}
      >
        <img
          src="/img/hero.jpg"
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 38%' }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg,rgba(23,19,15,.5) 0%,rgba(23,19,15,.3) 32%,rgba(23,19,15,.72) 72%,rgba(23,19,15,.9) 100%)'
          }}
        />
      </button>

      <div style={{ position: 'absolute', top: 96, left: 0, right: 0, textAlign: 'center', color: 'var(--cream)', pointerEvents: 'none' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'rgba(251,247,241,.82)' }}>
          {longDate(now.toISOString())}
        </p>
        <p style={{ margin: '2px 0 0', fontFamily: 'var(--serif)', fontSize: 76, lineHeight: 1, letterSpacing: '-0.03em' }}>
          {hh}:{mm}
        </p>
      </div>

      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 110, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {next ? (
          <>
            <div
              style={{
                borderRadius: 22,
                background: 'rgba(251,247,241,.9)',
                backdropFilter: 'blur(24px)',
                padding: '15px 16px',
                boxShadow: '0 12px 30px -14px rgba(0,0,0,.5)'
              }}
            >
              <NotificationHead when="jetzt" />
              <h3 style={{ margin: '10px 0 0', fontSize: 15.5, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                {countdown(next.startTime, next.endTime).replace(/^in /, 'In ')}: {next.title}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.45, color: '#4a423c' }}>
                {next.locationName ?? next.areaLabel}. {next.memberCount} von {next.maxPeople} sind dabei –{' '}
                {next.organizer.name.split(' ')[0]} organisiert.
              </p>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button
                  className="btn btn--primary"
                  style={{ flex: 1, height: 38, fontSize: 12.5, boxShadow: 'none' }}
                  onClick={() => go('/meetups')}
                >
                  Treffpunkt öffnen
                </button>
                <button
                  className="btn btn--sand"
                  style={{ flex: 1, height: 38, fontSize: 12.5 }}
                  onClick={() => go(`/chats/${next.id}`)}
                >
                  Ich bin unterwegs
                </button>
              </div>
            </div>

            {newest && (
              <div style={{ borderRadius: 22, background: 'rgba(251,247,241,.78)', backdropFilter: 'blur(24px)', padding: '14px 16px' }}>
                <NotificationHead when={ago(newest.joinedAt)} />
                <h3
                  style={{
                    margin: '9px 0 0',
                    fontSize: 14,
                    fontWeight: 650,
                    color: 'var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7
                  }}
                >
                  {newest.name} hat zugesagt
                  {newest.verified && <Tick size="sm" />}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#4a423c' }}>
                  {newest.verified ? 'Verifiziertes Profil' : 'Profil'} · {newest.stats.meetupsJoined} Treffen
                </p>
              </div>
            )}
          </>
        ) : (
          <div style={{ borderRadius: 22, background: 'rgba(251,247,241,.9)', backdropFilter: 'blur(24px)', padding: '15px 16px' }}>
            <NotificationHead when="jetzt" />
            <h3 style={{ margin: '10px 0 0', fontSize: 15.5, fontWeight: 650, color: 'var(--ink)' }}>
              Heute läuft etwas in deiner Nähe.
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.45, color: '#4a423c' }}>
              Sag bei einer Aktivität zu – dann erinnern wir dich eine Stunde vorher.
            </p>
            <button
              className="btn btn--primary btn--block"
              style={{ marginTop: 12, height: 38, fontSize: 12.5, boxShadow: 'none' }}
              onClick={() => go('/')}
            >
              Aktivitäten ansehen
            </button>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 28, textAlign: 'center' }}>
        <button onClick={back} aria-label="Schliessen">
          <span style={{ display: 'inline-block', width: 126, height: 5, borderRadius: 3, background: 'rgba(251,247,241,.6)' }} />
        </button>
      </div>
    </>
  );
}

function NotificationHead({ when }: { when: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: 'var(--ink)',
          display: 'grid',
          placeItems: 'center',
          flex: 'none'
        }}
      >
        <span style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--cream)', lineHeight: 1 }}>G</span>
      </span>
      <span className="label" style={{ fontSize: 10, letterSpacing: '.14em' }}>Gather</span>
      <span className="spacer" />
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{when}</span>
    </div>
  );
}
