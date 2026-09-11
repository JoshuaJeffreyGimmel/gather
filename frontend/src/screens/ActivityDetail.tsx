import { useEffect, useState } from 'react';
import { api } from '../api';
import { chf, dayName, span, time } from '../format';
import { photoPosition, photoUrl } from '../photos';
import { useRouter } from '../router';
import { useSession } from '../session';
import type { Activity } from '../types';
import { MeetingPointMap } from '../components/Map';
import { OrganizerRow, WhoIsComing } from '../components/ActivityCards';
import { Pill, SafetyNote, Spinner, StatusBar, Tick } from '../components/Ui';

export function ActivityDetail({ id }: { id: string }) {
  const { back, go } = useRouter();
  const { me, toast, toastError } = useSession();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overPhoto, setOverPhoto] = useState(true);

  useEffect(() => {
    let alive = true;
    setActivity(null);
    setMissing(false);
    api.activity(id)
      .then((r) => { if (alive) setActivity(r.activity); })
      .catch(() => { if (alive) setMissing(true); });
    return () => { alive = false; };
  }, [id]);

  async function join() {
    setBusy(true);
    try {
      const r = await api.join(id);
      setActivity(r.activity);
      toast('Zugesagt · Treffpunkt freigeschaltet');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    try {
      const r = await api.leave(id);
      setActivity(r.activity);
      toast('Abgesagt. Schade!');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <>
        <StatusBar />
        <div className="scroll pad">
          <button className="icon-btn icon-btn--sand" onClick={back} aria-label="Zurück">‹</button>
          <h1 className="display display--lg" style={{ marginTop: 28 }}>Diese Aktivität gibt es nicht mehr.</h1>
          <button className="btn btn--ink btn--block btn--sm" style={{ marginTop: 24 }} onClick={() => go('/')}>
            Zurück zum Entdecken
          </button>
        </div>
      </>
    );
  }

  if (!activity) {
    return (
      <>
        <StatusBar />
        <div className="scroll" style={{ ['--pad-top' as string]: '0px' }}>
          <div className="skeleton" style={{ height: 296, borderRadius: 0 }} />
          <div className="pad" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="skeleton" style={{ height: 40, width: '80%' }} />
            <div className="skeleton" style={{ height: 60, borderRadius: 18 }} />
            <div className="skeleton" style={{ height: 220, borderRadius: 22 }} />
          </div>
        </div>
      </>
    );
  }

  const full = activity.spotsFree === 0 && !activity.isJoined;
  const blocked = !me?.verified && activity.verifiedOnly;

  return (
    <>
      <StatusBar light={overPhoto} />

      <div
        className="scroll"
        style={{ ['--pad-top' as string]: '0px', ['--pad-bottom' as string]: '124px' }}
        onScroll={(e) => setOverPhoto(e.currentTarget.scrollTop < 220)}
      >
        {/* Hero */}
        <div className="photo" style={{ height: 296 }}>
          {activity.photo ? (
            <img src={photoUrl(activity.photo)} alt="" style={{ objectPosition: photoPosition(activity.photo) }} />
          ) : (
            <span style={{ position: 'absolute', inset: 0, background: 'var(--grad-150)' }} />
          )}
          <span
            className="photo__scrim"
            style={{
              background:
                'linear-gradient(180deg,rgba(23,19,15,.42) 0%,rgba(23,19,15,0) 30%,rgba(23,19,15,.25) 66%,rgba(23,19,15,.55) 100%)'
            }}
          />
          <div style={{ position: 'absolute', top: 58, left: 18, right: 18, display: 'flex', justifyContent: 'space-between' }}>
            <button className="icon-btn icon-btn--glass" onClick={back} aria-label="Zurück">‹</button>
            <button
              className="icon-btn icon-btn--glass"
              aria-label="Teilen"
              onClick={async () => {
                const url = window.location.href;
                if (navigator.share) {
                  try { await navigator.share({ title: activity.title, url }); } catch { /* dismissed */ }
                } else {
                  try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch { toast('Kopieren ging nicht', 'error'); }
                }
              }}
            >
              ⇪
            </button>
          </div>
          <div style={{ position: 'absolute', left: 20, bottom: 44, display: 'flex', gap: 7 }}>
            <Pill variant="tag">{activity.category}</Pill>
            <Pill variant="glass" style={{ padding: '5px 11px', fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>
              {dayName(activity.startTime)}
            </Pill>
          </div>
        </div>

        {/* The white sheet lifts over the photo */}
        <div style={{ position: 'relative', marginTop: -28, background: 'var(--cream)', borderRadius: '28px 28px 0 0', padding: '26px 20px 0' }}>
          <h1 className="display display--lg">{activity.title}</h1>

          <div style={{ marginTop: 16 }}>
            <OrganizerRow activity={activity} />
          </div>

          <div className="card card--lg card--clip" style={{ marginTop: 18 }}>
            <Row label="Zeit" value={span(activity.startTime, activity.endTime)} />
            <div className="card__divider" />
            <Row label="Ort" value={activity.locationRevealed ? activity.locationName! : activity.areaLabel} />
            <div className="card__divider" />
            <Row label="Gruppe" value={`${activity.memberCount} von ${activity.maxPeople} · Kleingruppe`} />
            <div className="card__divider" />
            <Row
              label="Kosten"
              value={activity.costTotal > 0 ? `${chf(activity.costPerPerson)} ${activity.costNote || 'Anteil'}` : 'Gratis'}
            />
          </div>

          <p className="body" style={{ marginTop: 18 }}>{activity.description}</p>

          <div style={{ marginTop: 20 }}>
            <WhoIsComing activity={activity} />
          </div>

          {/* The reward for saying yes. */}
          {activity.locationRevealed && (
            <div className="card card--lg card--clip" style={{ marginTop: 20 }}>
              <div style={{ height: 168, position: 'relative' }}>
                <MeetingPointMap lat={activity.lat} lng={activity.lng} precise />
              </div>
              <div className="row" style={{ padding: '15px 17px', gap: 12 }}>
                <div className="grow col" style={{ gap: 2 }}>
                  <span className="label">Treffpunkt</span>
                  <span style={{ fontSize: 14.5, fontWeight: 650 }}>{activity.locationName}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    {activity.locationHint || activity.address}
                  </span>
                </div>
                <a
                  className="btn btn--ink"
                  style={{ height: 38, padding: '0 14px', fontSize: 12, flex: 'none' }}
                  href={`https://www.openstreetmap.org/directions?to=${activity.lat}%2C${activity.lng}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Route
                </a>
              </div>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <SafetyNote>
              {activity.locationRevealed
                ? `Du bist zugesagt. Absagen ist bis zwei Stunden vorher gratis – danach zählt es auf deine Erscheinungsquote.`
                : 'Zusagen kann nur, wer Handynummer und Ausweis geprüft hat. Den exakten Treffpunkt siehst du direkt nach der Zusage.'}
            </SafetyNote>
          </div>
          <div style={{ height: 20 }} />
        </div>
      </div>

      {/* Sticky decision bar */}
      <div className="dock row" style={{ gap: 14 }}>
        {activity.isJoined ? (
          <div className="col grow" style={{ gap: 10 }}>
            <button
              className="btn btn--ink btn--block"
              onClick={activity.isOrganizer ? () => go(`/chats/${activity.id}`) : leave}
              disabled={busy}
            >
              {busy ? (
                <Spinner />
              ) : activity.isOrganizer ? (
                <>
                  <Tick size="md" />
                  Du organisierst · {activity.memberCount} von {activity.maxPeople}
                </>
              ) : (
                <>
                  <Tick size="md" />
                  Zugesagt · {activity.memberCount} von {activity.maxPeople}
                </>
              )}
            </button>
            <span className="center" style={{ fontSize: 11.5, color: 'var(--grey)' }}>
              Treffpunkt freigeschaltet · Erinnerung um {reminderTime(activity.startTime)}
            </span>
          </div>
        ) : (
          <>
            <div className="col" style={{ flex: 'none' }}>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                {activity.costTotal > 0 ? chf(activity.costPerPerson) : 'Gratis'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {activity.costTotal > 0 ? activity.costNote || 'Anteil' : 'keine Kosten'}
              </span>
            </div>
            <button className="btn btn--primary grow" onClick={join} disabled={busy || full || activity.isPast || blocked}>
              {busy ? <Spinner /> : activity.isPast ? 'Vorbei' : full ? 'Ausgebucht' : blocked ? 'Zuerst verifizieren' : 'Verifiziert zusagen'}
            </button>
          </>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="card__row">
      <span className="label">{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

/** One hour before the start — the moment plans usually die. */
function reminderTime(startIso: string) {
  return time(new Date(new Date(startIso).getTime() - 60 * 60000).toISOString());
}
