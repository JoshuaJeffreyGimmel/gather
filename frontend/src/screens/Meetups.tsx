import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { chf, countdown, dayName, relativeDay, span, time } from '../format';
import { photoPosition, photoUrl } from '../photos';
import { useRouter } from '../router';
import { useSession } from '../session';
import type { Activity, Meetups as MeetupsData } from '../types';
import { MeetingPointMap } from '../components/Map';
import { CompactRow } from '../components/ActivityCards';
import { AvatarStack, EmptyState, SafetyNote, Spinner, Stars, StatusBar, Tick, TopFade } from '../components/Ui';

const RATING_TAGS = ['Pünktlich', 'Entspannt', 'Gute Orga', 'Gerne wieder'];

export function MeetupsScreen() {
  const { go } = useRouter();
  const { toast, toastError } = useSession();
  const [data, setData] = useState<MeetupsData | null>(null);
  const [rating, setRating] = useState<Activity | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      setData(await api.meetups());
    } catch (e) {
      toastError(e);
    }
  }, [toastError]);

  useEffect(() => { void load(); }, [load]);

  // Keeps the countdown honest without re-fetching.
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  const next = data?.next ?? null;

  async function pay(id: string) {
    try {
      const r = await api.pay(id);
      toast(`${chf(r.paid)} gesendet`);
      await load();
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <>
      <StatusBar />
      <TopFade />
      <div className="scroll" style={{ ['--pad-bottom' as string]: 'calc(var(--tabbar-h) + 16px)' }}>
        <div className="pad row row--between">
          <h1 className="display display--sm">Dein Treffen</h1>
          <span className="meta" style={{ fontSize: 12.5 }}>{data ? `${data.past.length} im Verlauf` : ''}</span>
        </div>

        {!data ? (
          <div className="pad" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="skeleton" style={{ height: 210, borderRadius: 26 }} />
            <div className="skeleton" style={{ height: 240, borderRadius: 24 }} />
          </div>
        ) : !next ? (
          <EmptyState
            title="Noch nichts geplant."
            body="Sag bei einer Aktivität zu – dann erscheint hier dein Countdown, der Treffpunkt und die Kostenteilung."
            action={
              <button className="btn btn--primary btn--sm" onClick={() => go('/')}>
                Aktivitäten entdecken
              </button>
            }
          />
        ) : (
          <>
            {/* Countdown */}
            <div
              className="pad"
              style={{ marginTop: 18 }}
              key={tick /* re-renders the relative time */}
            >
              <div style={{ borderRadius: 26, background: 'var(--grad-150)', padding: '22px 20px', boxShadow: '0 18px 38px -18px rgba(229,55,42,.6)' }}>
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px 4px 5px',
                    borderRadius: 999, background: 'rgba(255,255,255,.22)', color: '#fff',
                    fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase'
                  }}
                >
                  <span
                    style={{
                      display: 'inline-grid', placeItems: 'center', width: 15, height: 15, borderRadius: '50%',
                      background: 'var(--cream)', color: 'var(--red)', fontSize: 8.5, fontWeight: 800, lineHeight: 1
                    }}
                  >
                    ✓
                  </span>
                  Bestätigt
                </span>
                <p className="display display--xl" style={{ margin: '14px 0 0', color: '#fff' }}>
                  {countdown(next.startTime, next.endTime)}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.92)' }}>
                  {next.title} · {span(next.startTime, next.endTime)}
                </p>
                <div className="row" style={{ marginTop: 18, gap: 11 }}>
                  <AvatarStack users={next.participants} size={30} ring="#FF7A2F" overlap={-10} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.92)' }}>
                    {next.memberCount} von {next.maxPeople} ·{' '}
                    {next.participants.every((p) => p.verified) ? 'alle verifiziert' : 'teilweise verifiziert'}
                  </span>
                </div>
              </div>
            </div>

            {/* Treffpunkt */}
            <div className="pad" style={{ marginTop: 14 }}>
              <div className="card card--lg card--clip">
                <div style={{ height: 168, position: 'relative' }}>
                  <MeetingPointMap lat={next.lat} lng={next.lng} precise={next.locationRevealed} />
                </div>
                <div className="row" style={{ padding: '15px 17px', gap: 12 }}>
                  <div className="grow col" style={{ gap: 2 }}>
                    <span className="label">Treffpunkt</span>
                    <span style={{ fontSize: 14.5, fontWeight: 650 }}>{next.locationName ?? next.areaLabel}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{next.locationHint || next.address}</span>
                  </div>
                  <a
                    className="btn btn--ink"
                    style={{ height: 38, padding: '0 14px', fontSize: 12, flex: 'none' }}
                    href={`https://www.openstreetmap.org/directions?to=${next.lat}%2C${next.lng}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Route
                  </a>
                </div>
              </div>
            </div>

            {/* Kostenteilung */}
            {next.costTotal > 0 && (
              <div className="pad" style={{ marginTop: 14 }}>
                <div className="card card--lg" style={{ padding: '18px 17px' }}>
                  <span className="label">Kostenteilung</span>
                  <div className="row row--between" style={{ marginTop: 13 }}>
                    <span style={{ fontSize: 13.5, color: '#4a423c' }}>{next.costNote || 'Gesamtkosten'}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{chf(next.costTotal)}</span>
                  </div>
                  <div className="row row--between" style={{ marginTop: 9 }}>
                    <span style={{ fontSize: 13.5, color: '#4a423c' }}>Geteilt auf {next.maxPeople} Personen</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>÷ {next.maxPeople}</span>
                  </div>
                  <div style={{ height: 1, background: 'var(--warm-line)', margin: '14px 0' }} />
                  <div className="row row--between" style={{ alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14, fontWeight: 650 }}>Dein Anteil</span>
                    <span style={{ fontFamily: 'var(--serif)', fontSize: 30, lineHeight: 1 }}>{chf(next.costPerPerson)}</span>
                  </div>
                  <button
                    className="btn btn--ink btn--block btn--sm"
                    style={{ marginTop: 15 }}
                    disabled={next.mySharePaid}
                    onClick={() => pay(next.id)}
                  >
                    {next.mySharePaid ? (
                      <>
                        <Tick size="sm" />
                        Anteil gesendet
                      </>
                    ) : (
                      'Anteil senden'
                    )}
                  </button>
                  <p className="center meta" style={{ margin: '10px 0 0', fontSize: 11.5 }}>
                    {next.paidCount} von {next.memberCount} haben bezahlt · niemand muss vorschiessen
                  </p>
                </div>
              </div>
            )}

            <div className="pad row" style={{ marginTop: 14, gap: 10 }}>
              <button className="btn btn--sand btn--sm grow" onClick={() => go(`/chats/${next.id}`)}>
                Gruppenchat
              </button>
              <button className="btn btn--ghost btn--sm grow" onClick={() => go(`/a/${next.id}`)}>
                Details
              </button>
            </div>

            <div className="pad" style={{ marginTop: 14 }}>
              <SafetyNote>
                Absagen bis 2 Stunden vorher ist gratis. Danach zählt es auf deine Erscheinungsquote.
              </SafetyNote>
            </div>
          </>
        )}

        {/* Wartet auf Bewertung */}
        {data?.toRate && (
          <div className="pad" style={{ marginTop: 26 }}>
            <span className="label">Wie war&apos;s?</span>
            <div style={{ marginTop: 11 }}>
              <CompactRow
                activity={data.toRate}
                onOpen={() => setRating(data.toRate)}
                trailing={
                  <span className="btn btn--primary" style={{ height: 36, padding: '0 14px', fontSize: 12.5, flex: 'none', boxShadow: 'none' }}>
                    Bewerten
                  </span>
                }
              />
            </div>
          </div>
        )}

        {/* Verlauf */}
        {data && data.upcoming.length > 1 && (
          <div className="pad" style={{ marginTop: 26 }}>
            <span className="label">Auch zugesagt</span>
            <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.upcoming.filter((a) => a.id !== next?.id).map((a) => (
                <CompactRow key={a.id} activity={a} onOpen={() => go(`/a/${a.id}`)} />
              ))}
            </div>
          </div>
        )}

        {data && data.past.length > 0 && (
          <div className="pad" style={{ marginTop: 26 }}>
            <span className="label">Verlauf</span>
            <div className="card card--clip" style={{ marginTop: 11 }}>
              {data.past.map((a, i) => (
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
                    {a.myRating ? (
                      <span style={{ fontSize: 11.5, color: 'var(--muted)', flex: 'none' }}>★ {a.myRating.stars}.0</span>
                    ) : (
                      <span style={{ fontSize: 11.5, color: 'var(--red)', fontWeight: 650, flex: 'none' }}>offen</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {rating && (
        <RatingSheet
          activity={rating}
          onClose={() => setRating(null)}
          onDone={async () => { setRating(null); await load(); }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------------- */

function RatingSheet({
  activity,
  onClose,
  onDone
}: {
  activity: Activity;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast, toastError } = useSession();
  const [stars, setStars] = useState(activity.myRating?.stars ?? 5);
  const [tags, setTags] = useState<string[]>(activity.myRating?.tags ?? ['Pünktlich']);
  const [allShowedUp, setAllShowedUp] = useState(activity.myRating?.allShowedUp ?? true);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api.rate(activity.id, stars, tags, allShowedUp);
      toast('Danke für die Bewertung');
      onDone();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Treffen bewerten">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <span className="sheet__grip" />
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <h2 className="display" style={{ margin: '22px 0 0', fontSize: 36 }}>Wie war&apos;s?</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--grey)', lineHeight: 1.5, textWrap: 'pretty' }}>
            Deine Bewertung bleibt anonym und hilft der nächsten Person bei der Zusage.
          </p>

          <div className="card row" style={{ marginTop: 18, gap: 12, padding: 12, borderRadius: 20 }}>
            {activity.photo ? (
              <img src={photoUrl(activity.photo)} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', objectPosition: photoPosition(activity.photo), flex: 'none' }} />
            ) : (
              <span className="datetile" style={{ width: 52, height: 52, borderRadius: 14, fontSize: 20 }} aria-hidden="true">
                {new Date(activity.startTime).getDate()}
              </span>
            )}
            <div className="grow col" style={{ gap: 2 }}>
              <span style={{ fontSize: 14.5, fontWeight: 650 }} className="truncate">{activity.title}</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                {dayName(activity.startTime)} {time(activity.startTime)} · {activity.areaLabel} · {activity.memberCount} Personen
              </span>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <Stars value={stars} onChange={setStars} />
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {RATING_TAGS.map((t) => (
              <button
                key={t}
                className="chip chip--rate"
                aria-pressed={tags.includes(t)}
                onClick={() => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            className="card row"
            style={{ marginTop: 20, width: '100%', gap: 13, padding: '15px 17px', borderRadius: 20, textAlign: 'left' }}
            onClick={() => setAllShowedUp((v) => !v)}
          >
            <Tick size="lg" />
            <span className="grow col" style={{ gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 650 }}>Alle sind erschienen</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Zählt auf die Quote der Gruppe</span>
            </span>
            <span className="switch" data-on={allShowedUp} aria-hidden="true">
              <span />
            </span>
          </button>
        </div>

        <button className="btn btn--primary btn--block" style={{ marginTop: 20 }} disabled={busy} onClick={submit}>
          {busy ? <Spinner /> : 'Bewertung senden'}
        </button>
        <div className="col" style={{ marginTop: 16, alignItems: 'center', gap: 6 }}>
          <button
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--grey)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            onClick={() => setReported(true)}
          >
            {reported ? 'Meldung eingegangen' : 'Etwas melden'}
          </button>
          <span className="center" style={{ fontSize: 11, color: 'var(--faint)' }}>
            Meldungen prüfen wir innerhalb von 24 Stunden. Verifizierung macht das möglich.
          </span>
        </div>
      </div>
    </div>
  );
}
