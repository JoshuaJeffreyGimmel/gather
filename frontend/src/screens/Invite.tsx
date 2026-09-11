import { useEffect, useState } from 'react';
import { api } from '../api';
import { relativeDay } from '../format';
import { useRouter } from '../router';
import { useSession } from '../session';
import type { Referrals } from '../types';
import { Avatar, ProgressBar, SafetyNote, StatusBar, Tick, TopFade } from '../components/Ui';

/** The referral programme: the reward only lands once the invitee is verified. */
export function Invite() {
  const { back } = useRouter();
  const { toast, toastError } = useSession();
  const [data, setData] = useState<Referrals | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    api.referrals()
      .then((r) => { if (alive) setData(r); })
      .catch((e) => { if (alive) toastError(e); });
    return () => { alive = false; };
  }, [toastError]);

  const link = data ? `${window.location.origin}/?ref=${encodeURIComponent(data.code)}` : '';

  async function copy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      toast('Code kopiert');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast('Kopieren ging nicht', 'error');
    }
  }

  async function share() {
    if (!data) return;
    const payload = {
      title: 'Komm zu Gather',
      text: `Mit meinem Code ${data.code} bekommen wir beide einen Monat Gather+ gratis.`,
      url: link
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        // The share sheet was dismissed — fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(`${payload.text} ${link}`);
      toast('Einladung kopiert');
    } catch {
      toast('Teilen ging nicht', 'error');
    }
  }

  return (
    <>
      <StatusBar />
      <TopFade />
      <div className="scroll" style={{ ['--pad-bottom' as string]: 'calc(var(--tabbar-h) + 16px)' }}>
        <div className="pad row" style={{ gap: 12 }}>
          <button className="icon-btn icon-btn--sand" onClick={back} aria-label="Zurück">‹</button>
          <span style={{ fontSize: 14, fontWeight: 650 }}>Freunde einladen</span>
        </div>

        <div className="pad" style={{ marginTop: 20 }}>
          <div style={{ position: 'relative', borderRadius: 26, overflow: 'hidden', boxShadow: '0 18px 38px -18px rgba(229,55,42,.55)' }}>
            <img
              src="/img/garden.jpg"
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 34%' }}
            />
            <div
              style={{
                position: 'relative',
                background: 'linear-gradient(150deg,rgba(255,176,58,.9),rgba(255,122,47,.94) 46%,rgba(229,55,42,.96))',
                padding: '24px 20px'
              }}
            >
              <span className="label label--lg" style={{ color: 'rgba(255,255,255,.86)', fontSize: 9.5, letterSpacing: '.18em' }}>
                Empfehlungsprogramm
              </span>
              <h1 className="display display--lg" style={{ margin: '12px 0 0', color: '#fff' }}>
                Einer fehlt immer noch.
              </h1>
              <p style={{ margin: '9px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'rgba(255,255,255,.92)', textWrap: 'pretty' }}>
                Lade eine Person ein – ihr beide bekommt einen Monat Gather+ gratis.
              </p>
            </div>
          </div>
        </div>

        <div className="pad" style={{ marginTop: 16 }}>
          <div className="card card--lg" style={{ padding: '18px 17px' }}>
            <span className="label">Dein Code</span>
            <div className="row" style={{ marginTop: 11, gap: 11 }}>
              <div
                className="grow"
                style={{
                  height: 56,
                  borderRadius: 16,
                  background: 'var(--sand-2)',
                  boxShadow: 'inset 0 0 0 1px var(--edge)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--serif)',
                  fontSize: 26,
                  letterSpacing: '.08em'
                }}
              >
                {data?.code ?? '· · · ·'}
              </div>
              <button
                onClick={copy}
                disabled={!data}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: 'var(--ink)',
                  color: 'var(--cream)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 650,
                  flex: 'none',
                  lineHeight: 1.2
                }}
                aria-label="Code kopieren"
              >
                {copied ? <Tick size="md" /> : 'Kopieren'}
              </button>
            </div>

            {data && (
              <>
                <div style={{ marginTop: 16 }}>
                  <ProgressBar value={data.verified} goal={data.goal} />
                </div>
                <p className="meta" style={{ margin: '9px 0 0', fontSize: 11.5 }}>
                  Nach drei verifizierten Einladungen: drei Monate Gather+.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="pad row" style={{ marginTop: 14, gap: 10 }}>
          <button className="btn btn--primary grow" style={{ height: 52, fontSize: 14 }} onClick={share} disabled={!data}>
            Link teilen
          </button>
          <button className="btn btn--sand grow" style={{ height: 52, fontSize: 14 }} onClick={copy} disabled={!data}>
            Code kopieren
          </button>
        </div>

        <div className="pad" style={{ marginTop: 24 }}>
          <span className="label">Deine Einladungen</span>
          <div className="card card--clip" style={{ marginTop: 11 }}>
            {!data ? (
              <div className="skeleton" style={{ height: 66 }} />
            ) : data.invites.length === 0 ? (
              <p className="meta" style={{ padding: '18px 16px', fontSize: 13 }}>
                Noch niemand eingeladen. Teile deinen Code – er zählt erst, wenn die Person verifiziert ist.
              </p>
            ) : (
              data.invites.map((inv, i) => (
                <div key={inv.id}>
                  {i > 0 && <div className="card__divider" style={{ margin: '0 16px' }} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px' }}>
                    <Avatar
                      user={{ name: inv.name ?? '?', avatar: inv.avatar, verified: inv.status === 'verified' }}
                      size={38}
                    />
                    <div className="grow col" style={{ gap: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{inv.name ?? 'Eingeladen'}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {inv.status === 'verified'
                          ? `Verifiziert · ${relativeDay(inv.createdAt)} dabei`
                          : 'Eingeladen · Verifizierung offen'}
                      </span>
                    </div>
                    {inv.status === 'verified' ? (
                      <Tick size="md" />
                    ) : (
                      <span style={{ fontSize: 11.5, color: 'var(--faint)', flex: 'none' }}>Ausstehend</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pad" style={{ marginTop: 16 }}>
          <SafetyNote>
            Die Belohnung gibt es erst, wenn die eingeladene Person verifiziert ist. Keine leeren Profile.
          </SafetyNote>
        </div>
      </div>
    </>
  );
}
