import { useMemo, useState } from 'react';
import { api } from '../api';
import { dayAndTime } from '../format';
import { useRouter } from '../router';
import { useSession } from '../session';
import type { Category, NewActivity } from '../types';
import { SafetyNote, Spinner, StatusBar, Stepper, Switch, Tick, TopFade } from '../components/Ui';

const CATEGORIES: Category[] = ['Sport', 'Lernen', 'Kino', 'Gaming', 'Essen', 'Outdoor'];

/** A photo per category, so a new activity looks like the seeded ones. */
const CATEGORY_PHOTO: Record<Category, string | null> = {
  Sport: 'sport.jpg',
  Lernen: null,
  Kino: null,
  Gaming: 'park.jpg',
  Essen: 'spritz.jpg',
  Outdoor: 'rooftop.jpg'
};

/** Real Zurich meeting points, so the map pin lands where it should. */
const PLACES = [
  { name: 'Josefwiese, Kreis 5', hint: 'Eingang Josefstrasse', area: 'Josefwiese, Kreis 5', address: 'Josefstrasse 84, 8005 Zürich', lat: 47.38732, lng: 8.52539 },
  { name: 'Oberer Letten', hint: 'Beim oberen Steg', area: 'Oberer Letten, Kreis 5', address: 'Wasserwerkstrasse 141, 8037 Zürich', lat: 47.38607, lng: 8.53398 },
  { name: 'Zürihorn, Chinagarten', hint: 'Beim Beachfeld', area: 'Zürihorn, Kreis 8', address: 'Bürglistrasse 15, 8008 Zürich', lat: 47.35479, lng: 8.55245 },
  { name: 'ETH Zentrum', hint: 'Haupteingang Rämistrasse', area: 'ETH Zentrum, Kreis 1', address: 'Rämistrasse 101, 8092 Zürich', lat: 47.37631, lng: 8.54798 },
  { name: 'Helvetiaplatz', hint: 'Beim Brunnen', area: 'Helvetiaplatz, Kreis 4', address: 'Helvetiaplatz, 8004 Zürich', lat: 47.37631, lng: 8.52616 },
  { name: 'Hardbrücke', hint: 'Unter der Brücke, Seite Hardstrasse', area: 'Hardbrücke, Kreis 5', address: 'Hardstrasse 219, 8005 Zürich', lat: 47.38927, lng: 8.51846 }
];

function slot(dayOffset: number, hour: number, minute: number) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Four decisions, under a minute. */
export function CreateActivity() {
  const { back, replace } = useRouter();
  const { me, toast, toastError } = useSession();

  const [category, setCategory] = useState<Category>('Sport');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxPeople, setMaxPeople] = useState(6);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [placeIndex, setPlaceIndex] = useState(0);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [cost, setCost] = useState('');
  const [costNote, setCostNote] = useState('');
  const [busy, setBusy] = useState(false);

  const slots = useMemo(() => {
    const today = slot(0, 18, 30);
    const late = slot(0, 20, 0);
    const now = Date.now();
    return [
      { key: 'a', date: today.getTime() > now ? today : slot(1, 18, 30) },
      { key: 'b', date: late.getTime() > now ? late : slot(1, 20, 0) },
      { key: 'c', date: slot(1, 18, 0) }
    ];
  }, []);
  const [slotKey, setSlotKey] = useState('a');
  const [customTime, setCustomTime] = useState('');

  const place = PLACES[placeIndex];
  const startsAt = useMemo(() => {
    if (slotKey === 'custom' && customTime) {
      const d = new Date(customTime);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return slots.find((s) => s.key === slotKey)?.date ?? slots[0].date;
  }, [slotKey, customTime, slots]);

  const ready = title.trim().length > 1 && !!me?.verified;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    const draft: NewActivity = {
      category,
      title: title.trim(),
      description: description.trim(),
      startTime: startsAt.toISOString(),
      endTime: new Date(startsAt.getTime() + 90 * 60000).toISOString(),
      areaLabel: place.area,
      locationName: place.name,
      address: place.address,
      locationHint: place.hint,
      lat: place.lat,
      lng: place.lng,
      photo: CATEGORY_PHOTO[category],
      maxPeople,
      verifiedOnly,
      costTotal: Math.max(0, Number(cost.replace(',', '.')) || 0),
      costNote: costNote.trim()
    };
    try {
      const r = await api.create(draft);
      toast('Aktivität ist online');
      replace(`/a/${r.activity.id}`);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StatusBar />
      <TopFade />
      <div className="scroll" style={{ ['--pad-bottom' as string]: '118px' }}>
        <div className="pad row row--between">
          <button style={{ fontSize: 14, color: 'var(--muted)' }} onClick={back}>
            Abbrechen
          </button>
          <span style={{ fontSize: 14, fontWeight: 650 }}>Neue Aktivität</span>
          <span style={{ width: 62 }} />
        </div>

        <div className="pad" style={{ paddingTop: 22 }}>
          <h1 className="display display--md">Was machst du heute?</h1>
          <p className="meta" style={{ marginTop: 7 }}>Vier Angaben, unter einer Minute.</p>
        </div>

        {/* 1 — Kategorie */}
        <section className="pad" style={{ paddingTop: 24 }}>
          <span className="label">1 · Kategorie</span>
          <div style={{ marginTop: 11, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
            {CATEGORIES.map((c) => {
              const on = category === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  aria-pressed={on}
                  style={{
                    height: 74,
                    borderRadius: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-end',
                    padding: 11,
                    fontFamily: 'var(--serif)',
                    fontSize: 17,
                    background: on ? 'var(--grad)' : 'var(--paper)',
                    color: on ? '#fff' : 'var(--ink)',
                    boxShadow: on ? 'var(--cta-glow)' : 'inset 0 0 0 1px var(--edge)',
                    transition: 'background .16s ease, color .16s ease'
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </section>

        {/* Titel & Beschreibung */}
        <section className="pad" style={{ paddingTop: 24 }}>
          <span className="label">Titel</span>
          <input
            className="field field--sm"
            style={{ marginTop: 11 }}
            placeholder="z. B. Feierabend-Volleyball"
            aria-label="Titel"
            value={title}
            maxLength={70}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="field field--area"
            style={{ marginTop: 10 }}
            placeholder="Worum geht's? Was soll man mitbringen?"
            aria-label="Beschreibung"
            value={description}
            maxLength={600}
            onChange={(e) => setDescription(e.target.value)}
          />
        </section>

        {/* 2 — Wann */}
        <section className="pad" style={{ paddingTop: 24 }}>
          <span className="label">2 · Wann</span>
          <div style={{ marginTop: 11, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {slots.map((s) => (
              <button key={s.key} className="chip chip--lg" aria-pressed={slotKey === s.key} onClick={() => setSlotKey(s.key)}>
                {dayAndTime(s.date.toISOString())}
              </button>
            ))}
            <button className="chip chip--lg" aria-pressed={slotKey === 'custom'} onClick={() => setSlotKey('custom')}>
              Anderes …
            </button>
          </div>
          {slotKey === 'custom' && (
            <input
              type="datetime-local"
              className="field field--sm"
              style={{ marginTop: 11 }}
              aria-label="Datum und Uhrzeit"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
            />
          )}
        </section>

        {/* 3 — Wo */}
        <section className="pad" style={{ paddingTop: 24 }}>
          <span className="label">3 · Wo</span>
          <button
            className="card tap"
            style={{ marginTop: 11, width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '15px 17px', borderRadius: 20, textAlign: 'left' }}
            onClick={() => setPlacesOpen((v) => !v)}
            aria-expanded={placesOpen}
          >
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--sand)', display: 'grid', placeItems: 'center', fontSize: 14, flex: 'none' }}>
              ◎
            </span>
            <span className="grow col" style={{ gap: 2 }}>
              <span style={{ fontSize: 14.5, fontWeight: 600 }}>{place.name}</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{place.hint}</span>
            </span>
            <span style={{ fontSize: 15, color: 'var(--faint)' }}>{placesOpen ? '⌃' : '›'}</span>
          </button>
          {placesOpen && (
            <div className="card card--clip" style={{ marginTop: 8 }}>
              {PLACES.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => { setPlaceIndex(i); setPlacesOpen(false); }}
                  style={{ display: 'flex', width: '100%', textAlign: 'left', padding: '13px 16px', gap: 10, alignItems: 'center' }}
                >
                  <span className="grow col" style={{ gap: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{p.address}</span>
                  </span>
                  {i === placeIndex && <Tick size="sm" />}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 4 — Wie viele */}
        <section className="pad" style={{ paddingTop: 24 }}>
          <span className="label">4 · Wie viele</span>
          <div
            className="card row row--between"
            style={{ marginTop: 11, padding: '16px 18px', borderRadius: 20 }}
          >
            <div className="col" style={{ gap: 2 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 34, lineHeight: 1 }}>{maxPeople}</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Personen inkl. dir</span>
            </div>
            <Stepper value={maxPeople} min={3} max={6} onChange={setMaxPeople} label="Gruppengrösse" />
          </div>
          <p className="meta" style={{ margin: '9px 2px 0', fontSize: 11.5 }}>
            Aus unseren Tests: 3 bis 6 Personen funktionieren am besten.
          </p>
        </section>

        {/* Kosten */}
        <section className="pad" style={{ paddingTop: 24 }}>
          <span className="label">Kosten teilen (optional)</span>
          <div style={{ marginTop: 11, display: 'flex', gap: 10 }}>
            <input
              className="field field--sm"
              style={{ width: 118, flex: 'none' }}
              inputMode="decimal"
              placeholder="CHF 0"
              aria-label="Gesamtkosten in Franken"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
            <input
              className="field field--sm"
              placeholder="wofür?"
              aria-label="Wofür sind die Kosten"
              value={costNote}
              maxLength={40}
              onChange={(e) => setCostNote(e.target.value)}
            />
          </div>
          {Number(cost.replace(',', '.')) > 0 && (
            <p className="meta" style={{ margin: '9px 2px 0', fontSize: 11.5 }}>
              Geteilt auf {maxPeople} Personen:{' '}
              <strong style={{ fontWeight: 650, color: 'var(--ink)' }}>
                CHF {((Number(cost.replace(',', '.')) || 0) / maxPeople).toFixed(2)}
              </strong>{' '}
              pro Person.
            </p>
          )}
        </section>

        {/* Verifiziert-Schalter */}
        <section className="pad" style={{ paddingTop: 22 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 17px', borderRadius: 20, background: 'var(--ink)' }}
          >
            <Tick size="lg" />
            <span className="grow col" style={{ gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 650, color: 'var(--cream)' }}>Nur verifizierte Mitglieder</span>
              <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>Empfohlen. So bleibt Gather Gather.</span>
            </span>
            <Switch on={verifiedOnly} onChange={setVerifiedOnly} label="Nur verifizierte Mitglieder" />
          </div>
        </section>

        {!me?.verified && (
          <div className="pad" style={{ paddingTop: 16 }}>
            <SafetyNote>Erstellen kann nur, wer Handynummer und Ausweis geprüft hat.</SafetyNote>
          </div>
        )}
      </div>

      <div className="dock">
        <button className="btn btn--primary btn--block" disabled={!ready || busy} onClick={submit}>
          {busy ? <Spinner /> : 'Aktivität erstellen'}
        </button>
      </div>
    </>
  );
}
