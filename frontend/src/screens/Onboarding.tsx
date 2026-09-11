import { useEffect, useRef, useState } from 'react';
import { api, ApiError, setToken } from '../api';
import { prettyPhone } from '../format';
import { useSession } from '../session';
import type { Me } from '../types';
import { SafetyNote, Spinner, StatusBar, Tick } from '../components/Ui';

type Step = 0 | 1 | 2 | 3 | 4;

/**
 * Five steps, about ninety seconds. Verification is not a wall put up at the
 * end — it is the promise the product is built on, so it gets its own screen
 * and its own explanation.
 */
export function Onboarding() {
  const { signIn, toastError } = useSession();
  const [step, setStep] = useState<Step>(0);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [why, setWhy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const digits = phone.replace(/\D/g, '');

  async function sendCode() {
    if (digits.length < 9) return;
    setBusy(true);
    try {
      const r = await api.requestCode('+41' + digits);
      setDevCode(r.devCode);
      setResendIn(30);
      setStep(2);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  async function checkCode() {
    if (code.length !== 6) return;
    setBusy(true);
    try {
      const r = await api.verifyCode('+41' + digits, code);
      // The token is needed for the ID call, but the session only starts once
      // the flow is finished — otherwise the app would swap in underneath us
      // and the verification step would never be seen.
      setToken(r.token);
      setTokenState(r.token);
      setUser(r.user);
      // A returning, already-verified member skips the scan.
      setStep(r.user.verified ? 4 : 3);
    } catch (e) {
      toastError(e);
      if (e instanceof ApiError && e.code === 'invalid_code') setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function scanId() {
    setScanning(true);
    try {
      // The scan itself is mocked; the pause is what makes the screen readable.
      await new Promise((r) => window.setTimeout(r, 1600));
      const { user: verified } = await api.verifyId();
      setUser(verified);
      setStep(4);
    } catch (e) {
      toastError(e);
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      <StatusBar light={step === 0 || step === 4} />
      {step === 0 && <Hero onNext={() => setStep(1)} />}
      {step === 1 && (
        <PhoneStep
          phone={phone}
          onPhone={setPhone}
          onBack={() => setStep(0)}
          onNext={sendCode}
          busy={busy}
        />
      )}
      {step === 2 && (
        <CodeStep
          phone={'+41' + digits}
          code={code}
          onCode={setCode}
          devCode={devCode}
          resendIn={resendIn}
          onResend={sendCode}
          onBack={() => setStep(1)}
          onNext={checkCode}
          busy={busy}
        />
      )}
      {step === 3 && (
        <IdStep onBack={() => setStep(2)} onScan={scanId} scanning={scanning} onWhy={() => setWhy(true)} />
      )}
      {step === 4 && <Done onEnter={() => token && user && signIn(token, user)} />}

      {why && <WhyModal onClose={() => setWhy(false)} />}
    </>
  );
}

/* -- 1/5 ---------------------------------------------------------------- */

function Hero({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <img
        src="/img/hero.jpg"
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 28%' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg,rgba(23,19,15,.45) 0%,rgba(23,19,15,0) 26%,rgba(23,19,15,.28) 52%,rgba(23,19,15,.92) 88%)'
        }}
      />
      <div style={{ position: 'absolute', top: 58, left: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--cream)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}
        >
          <img src="/img/logo.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain', mixBlendMode: 'multiply' }} />
        </span>
        <span style={{ color: 'var(--cream)', fontFamily: 'var(--serif)', fontSize: 22 }}>Gather</span>
      </div>
      <div style={{ position: 'absolute', left: 24, right: 24, bottom: 36, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span
          className="label label--lg"
          style={{ letterSpacing: '.2em', color: '#ffc98a', fontSize: 9.5 }}
        >
          Finden · Planen · Treffen
        </span>
        <h1 className="display display--xl" style={{ color: 'var(--cream)' }}>
          Aus «wir sollten mal» wird heute 18:30.
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(251,247,241,.82)', textWrap: 'pretty' }}>
          Gather zeigt dir, was heute in deiner Nähe läuft – und bringt dich wirklich hin.
        </p>
        <button className="btn btn--primary btn--tall btn--block" style={{ marginTop: 6 }} onClick={onNext}>
          Los geht&apos;s
        </button>
        <span className="center" style={{ fontSize: 13, color: 'rgba(251,247,241,.7)' }}>
          Schon dabei?{' '}
          <button onClick={onNext} style={{ color: 'var(--cream)', fontWeight: 600 }}>
            Anmelden
          </button>
        </span>
      </div>
    </div>
  );
}

/* -- shared chrome for steps 2–4 ---------------------------------------- */

function StepShell({
  step,
  onBack,
  children
}: {
  step: 1 | 2 | 3;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--cream)',
        padding: '62px 24px calc(28px + env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div className="row row--between">
        <button className="icon-btn" onClick={onBack} aria-label="Zurück">
          ‹
        </button>
        <div className="progress-dots" aria-label={`Schritt ${step} von 4`}>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} data-on={n <= step} />
          ))}
        </div>
        <span style={{ width: 38 }} />
      </div>
      {children}
    </div>
  );
}

/* -- 2/5 ---------------------------------------------------------------- */

function PhoneStep({
  phone,
  onPhone,
  onBack,
  onNext,
  busy
}: {
  phone: string;
  onPhone: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const digits = phone.replace(/\D/g, '');

  // 79 412 88 03
  function format(raw: string) {
    const d = raw.replace(/\D/g, '').slice(0, 9);
    return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
  }

  return (
    <StepShell step={1} onBack={onBack}>
      <h2 className="display display--lg" style={{ marginTop: 44 }}>
        Zuerst deine Nummer.
      </h2>
      <p className="lede" style={{ marginTop: 12 }}>
        Damit wir sicher wissen: Auf der anderen Seite sitzt ein echter Mensch.
      </p>

      <form
        style={{ marginTop: 30, display: 'flex', gap: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
      >
        <span
          style={{
            width: 82,
            height: 60,
            borderRadius: 16,
            background: 'var(--paper)',
            boxShadow: 'inset 0 0 0 1px var(--edge)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 17,
            fontWeight: 600,
            flex: 'none'
          }}
        >
          +41
        </span>
        <input
          ref={ref}
          className="field"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="79 412 88 03"
          aria-label="Handynummer"
          value={format(phone)}
          onChange={(e) => onPhone(e.target.value)}
        />
      </form>

      <div style={{ marginTop: 18 }}>
        <SafetyNote>
          Deine Nummer sieht niemand – auch nicht andere Teilnehmende. Sie dient nur der Prüfung.
        </SafetyNote>
      </div>

      <p className="meta" style={{ marginTop: 14, fontSize: 11.5 }}>
        Demo: <strong style={{ fontWeight: 650 }}>79 000 00 00</strong> öffnet das eingerichtete Profil.
      </p>

      <div className="spacer" />
      <button className="btn btn--primary btn--tall btn--block" disabled={digits.length < 9 || busy} onClick={onNext}>
        {busy ? <Spinner /> : 'Code senden'}
      </button>
    </StepShell>
  );
}

/* -- 3/5 ---------------------------------------------------------------- */

function CodeStep({
  phone,
  code,
  onCode,
  devCode,
  resendIn,
  onResend,
  onBack,
  onNext,
  busy
}: {
  phone: string;
  code: string;
  onCode: (v: string) => void;
  devCode: string | null;
  resendIn: number;
  onResend: () => void;
  onBack: () => void;
  onNext: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  // Six boxes drawn over one real input, so the keyboard and paste both work.
  return (
    <StepShell step={2} onBack={onBack}>
      <h2 className="display display--lg" style={{ marginTop: 44 }}>
        Code eingeben.
      </h2>
      <p className="lede" style={{ marginTop: 12 }}>
        Wir haben dir sechs Ziffern an <span style={{ whiteSpace: 'nowrap' }}>{prettyPhone(phone)}</span> geschickt.
      </p>

      <div style={{ position: 'relative', marginTop: 30 }}>
        <input
          ref={ref}
          value={code}
          onChange={(e) => onCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Sechsstelliger Code"
          maxLength={6}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', border: 0 }}
        />
        <div style={{ display: 'flex', gap: 9 }} onClick={() => ref.current?.focus()}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="codebox" data-active={i === code.length}>
              {code[i] ?? (i === code.length ? <span className="caret" /> : '')}
            </span>
          ))}
        </div>
      </div>

      <div className="row row--between" style={{ marginTop: 16 }}>
        {resendIn > 0 ? (
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            Erneut senden in 0:{String(resendIn).padStart(2, '0')}
          </span>
        ) : (
          <button
            onClick={onResend}
            style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Code erneut senden
          </button>
        )}
      </div>

      {devCode && (
        <button
          onClick={() => onCode(devCode)}
          style={{
            marginTop: 16,
            alignSelf: 'flex-start',
            padding: '9px 14px',
            borderRadius: 12,
            background: 'var(--sand)',
            boxShadow: 'inset 0 0 0 1px var(--edge)',
            fontSize: 11.5,
            color: 'var(--grey)',
            textAlign: 'left'
          }}
        >
          Demo: kein SMS-Versand — Code <strong style={{ fontWeight: 700 }}>{devCode}</strong> einsetzen
        </button>
      )}

      <div className="spacer" />
      <button className="btn btn--primary btn--tall btn--block" disabled={code.length !== 6 || busy} onClick={onNext}>
        {busy ? <Spinner /> : 'Weiter'}
      </button>
    </StepShell>
  );
}

/* -- 4/5 ---------------------------------------------------------------- */

function IdStep({
  onBack,
  onScan,
  scanning,
  onWhy
}: {
  onBack: () => void;
  onScan: () => void;
  scanning: boolean;
  onWhy: () => void;
}) {
  const promises = [
    'Nur zur Prüfung – danach sofort gelöscht.',
    'Dauert rund 30 Sekunden.',
    'Andere sehen nur «verifiziert» – keine Daten.'
  ];
  return (
    <StepShell step={3} onBack={onBack}>
      <h2 className="display display--lg" style={{ marginTop: 34 }}>
        Und einmal dein Ausweis.
      </h2>
      <p className="lede" style={{ marginTop: 12 }}>
        Das ist der Schritt, der Gather von einem Gruppenchat unterscheidet.
      </p>

      <div
        style={{
          marginTop: 22,
          position: 'relative',
          height: 156,
          borderRadius: 20,
          background: 'linear-gradient(150deg,#EFE5D5,#E1D3BD)',
          boxShadow: 'inset 0 0 0 1px #DFD2BC',
          overflow: 'hidden',
          padding: 18
        }}
      >
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ width: 52, height: 66, borderRadius: 8, background: '#CFBFA5' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
            <div style={{ width: '64%', height: 9, borderRadius: 5, background: 'var(--ink)', opacity: 0.72 }} />
            <div style={{ width: '88%', height: 7, borderRadius: 4, background: 'var(--ink)', opacity: 0.24 }} />
            <div style={{ width: '52%', height: 7, borderRadius: 4, background: 'var(--ink)', opacity: 0.24 }} />
            <div style={{ width: '74%', height: 7, borderRadius: 4, background: 'var(--ink)', opacity: 0.16 }} />
          </div>
        </div>
        <div style={{ marginTop: 16, height: 20, opacity: 0.3 }}>
          <span
            style={{
              display: 'block',
              height: '100%',
              background: 'repeating-linear-gradient(90deg,#171310 0 2px,transparent 2px 5px)'
            }}
          />
        </div>
        {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
          <span key={corner} style={cornerStyle(corner)} />
        ))}
        {scanning && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(251,247,241,.72)',
              display: 'grid',
              placeItems: 'center',
              gap: 10
            }}
          >
            <span className="col" style={{ alignItems: 'center', gap: 10 }}>
              <Spinner size={26} color="var(--red)" />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--grey)' }}>Ausweis wird geprüft …</span>
            </span>
          </span>
        )}
      </div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {promises.map((p) => (
          <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Tick size="md" />
            <p style={{ fontSize: 13, lineHeight: 1.45 }}>{p}</p>
          </div>
        ))}
      </div>

      <div className="spacer" />
      <button className="btn btn--primary btn--tall btn--block" onClick={onScan} disabled={scanning}>
        {scanning ? <Spinner /> : 'Ausweis scannen'}
      </button>
      <button
        onClick={onWhy}
        style={{ marginTop: 14, fontSize: 12.5, color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        Warum wir das brauchen
      </button>
    </StepShell>
  );
}

function cornerStyle(corner: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties {
  const c = '2.5px solid var(--red)';
  const base: React.CSSProperties = { position: 'absolute', width: 26, height: 26 };
  if (corner === 'tl') return { ...base, top: 12, left: 12, borderTop: c, borderLeft: c, borderRadius: '8px 0 0 0' };
  if (corner === 'tr') return { ...base, top: 12, right: 12, borderTop: c, borderRight: c, borderRadius: '0 8px 0 0' };
  if (corner === 'bl') return { ...base, bottom: 12, left: 12, borderBottom: c, borderLeft: c, borderRadius: '0 0 0 8px' };
  return { ...base, bottom: 12, right: 12, borderBottom: c, borderRight: c, borderRadius: '0 0 8px 0' };
}

/* -- 5/5 ---------------------------------------------------------------- */

function Done({ onEnter }: { onEnter: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--grad-165)',
        padding: '62px 26px calc(28px + env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'grid', placeItems: 'center' }}>
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: 'var(--cream)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 32,
              fontWeight: 700,
              color: 'var(--red)',
              lineHeight: 1
            }}
          >
            ✓
          </div>
        </div>
        <h2 className="display display--xl" style={{ color: '#fff' }}>
          Du bist verifiziert.
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: 'rgba(255,255,255,.9)', maxWidth: 270, textWrap: 'pretty' }}>
          Ab jetzt kannst du zusagen – und alle anderen wissen, dass du echt bist.
        </p>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '7px 15px 7px 8px',
            borderRadius: 999,
            background: 'var(--cream)',
            color: 'var(--ink)',
            fontSize: 12.5,
            fontWeight: 650
          }}
        >
          <span
            style={{
              display: 'inline-grid',
              placeItems: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--ink)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              lineHeight: 1
            }}
          >
            ✓
          </span>
          Handynummer + Ausweis
        </span>
      </div>
      <button className="btn btn--cream btn--tall btn--block" onClick={onEnter}>
        Aktivitäten entdecken
      </button>
    </div>
  );
}

function WhyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" style={{ justifyContent: 'center' }} onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <span className="label">Warum der Ausweis</span>
        <h3 className="display display--sm" style={{ marginTop: 10 }}>
          Weil Zusagen etwas wert sein soll.
        </h3>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            'Jede Person hier ist genau einmal vorhanden. Kein Zweitprofil, keine Fake-Gruppe.',
            'Wer sich nicht an die Regeln hält, ist wirklich draussen – nicht nur bis zum nächsten Login.',
            'Wir speichern das Ausweisfoto nicht. Es bleibt nur der Haken.'
          ].map((t) => (
            <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Tick size="sm" />
              <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--grey)' }}>{t}</p>
            </div>
          ))}
        </div>
        <button className="btn btn--ink btn--block btn--sm" style={{ marginTop: 22 }} onClick={onClose}>
          Verstanden
        </button>
      </div>
    </div>
  );
}
