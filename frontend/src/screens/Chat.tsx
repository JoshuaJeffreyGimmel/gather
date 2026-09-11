import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { dayName, time } from '../format';
import { useRouter } from '../router';
import { useSession } from '../session';
import type { Activity, Message } from '../types';
import { ChatHeaderAvatars } from './Chats';
import { Avatar, SafetyNote, StatusBar, Tick } from '../components/Ui';

const POLL_MS = 3000;

export function Chat({ id }: { id: string }) {
  const { back, go } = useRouter();
  const { me, toastError } = useSession();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [denied, setDenied] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | null>(null);

  const stickToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  }, []);

  useEffect(() => {
    let alive = true;
    setMessages([]);
    lastAt.current = null;
    Promise.all([api.activity(id), api.messages(id)])
      .then(([a, m]) => {
        if (!alive) return;
        setActivity(a.activity);
        setMessages(m.messages);
        lastAt.current = m.messages[m.messages.length - 1]?.createdAt ?? null;
        window.setTimeout(() => stickToBottom(), 0);
      })
      .catch((e) => { if (alive) setDenied(true); void e; });
    return () => { alive = false; };
  }, [id, stickToBottom]);

  // Polling, not websockets — three seconds is plenty for a group of six.
  useEffect(() => {
    if (denied) return;
    let alive = true;
    const t = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await api.messages(id, lastAt.current ?? undefined);
        if (!alive || r.messages.length === 0) return;
        setMessages((cur) => {
          const seen = new Set(cur.map((m) => m.id));
          const fresh = r.messages.filter((m) => !seen.has(m.id));
          return fresh.length ? [...cur, ...fresh] : cur;
        });
        lastAt.current = r.messages[r.messages.length - 1].createdAt;
        window.setTimeout(() => stickToBottom(true), 0);
      } catch { /* the next tick tries again */ }
    }, POLL_MS);
    return () => { alive = false; window.clearInterval(t); };
  }, [id, denied, stickToBottom]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      const r = await api.send(id, text);
      setMessages((cur) => (cur.some((m) => m.id === r.message.id) ? cur : [...cur, r.message]));
      lastAt.current = r.message.createdAt;
      window.setTimeout(() => stickToBottom(true), 0);
    } catch (e) {
      setDraft(text);
      toastError(e);
    } finally {
      setSending(false);
    }
  }

  if (denied) {
    return (
      <>
        <StatusBar />
        <div className="scroll pad">
          <button className="icon-btn icon-btn--sand" onClick={back} aria-label="Zurück">‹</button>
          <h1 className="display display--lg" style={{ marginTop: 28 }}>Nur Zugesagte schreiben hier.</h1>
          <p className="lede" style={{ marginTop: 12 }}>
            Sag bei der Aktivität zu, dann bist du im Gruppenchat dabei.
          </p>
          <button className="btn btn--primary btn--block btn--sm" style={{ marginTop: 24 }} onClick={() => go(`/a/${id}`)}>
            Zur Aktivität
          </button>
        </div>
      </>
    );
  }

  const allVerified = !!activity && activity.participants.every((p) => p.verified);

  return (
    <>
      <StatusBar />

      <div className="topbar">
        <button className="icon-btn icon-btn--sand" onClick={back} aria-label="Zurück">‹</button>
        <button className="grow col" style={{ gap: 1, textAlign: 'left' }} onClick={() => activity && go(`/a/${activity.id}`)}>
          <span style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em' }} className="truncate">
            {activity?.title ?? 'Chat'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
            {activity ? `${activity.memberCount} Teilnehmende` : ''}
            {allVerified && (
              <>
                <Tick size="xs" />
                alle verifiziert
              </>
            )}
          </span>
        </button>
        {activity && <ChatHeaderAvatars users={activity.participants} />}
      </div>

      <div
        ref={listRef}
        className="scroll"
        style={{
          ['--pad-top' as string]: 'calc(112px + env(safe-area-inset-top))',
          ['--pad-bottom' as string]: 'calc(var(--tabbar-h) + 70px)',
          paddingLeft: 18,
          paddingRight: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {activity && (
          <div className="row" style={{ gap: 12, padding: '13px 15px', borderRadius: 18, background: 'var(--ink)' }}>
            <div className="grow col" style={{ gap: 2 }}>
              <span className="label" style={{ color: 'var(--dim)' }}>Angepinnt</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--cream)' }}>
                {dayName(activity.startTime)} {time(activity.startTime)} · {activity.locationName ?? activity.areaLabel}
              </span>
            </div>
            <button
              className="btn btn--primary"
              style={{ height: 32, padding: '0 13px', fontSize: 11.5, flex: 'none', boxShadow: 'none' }}
              onClick={() => go(`/a/${activity.id}`)}
            >
              Treffpunkt
            </button>
          </div>
        )}

        {messages.map((m) => {
          if (m.kind === 'system') {
            const verified = m.text.includes('verifiziert');
            const label = verified ? m.text.replace(' · verifiziert', '') : m.text;
            return (
              <div key={m.id} className="center" style={{ padding: '4px 0' }}>
                <span style={{ fontSize: 10.5, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {label}
                  {verified && (
                    <>
                      <Tick size="xs" />
                      verifiziert
                    </>
                  )}
                </span>
              </div>
            );
          }

          const mine = m.author?.id === me?.id;
          if (mine) {
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div className="bubble bubble--mine" style={{ maxWidth: '76%' }}>
                  {m.text}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
              <Avatar user={m.author} size={28} />
              <div style={{ maxWidth: '74%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 650, color: 'var(--muted)', paddingLeft: 3 }}>
                  {m.author?.name}
                </span>
                <div className="bubble">{m.text}</div>
                <span style={{ fontSize: 10, color: 'var(--faint)', paddingLeft: 3 }}>{time(m.createdAt)}</span>
              </div>
            </div>
          );
        })}

        <SafetyNote>Nur Zugesagte schreiben hier. Der Chat schliesst 24 Stunden nach dem Treffen.</SafetyNote>
        <div ref={bottomRef} />
      </div>

      <form
        className="dock dock--above-tabs row"
        style={{ gap: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          className="composer"
          placeholder="Nachricht …"
          aria-label="Nachricht"
          value={draft}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="submit"
          aria-label="Senden"
          disabled={!draft.trim() || sending}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--grad)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 16,
            flex: 'none',
            opacity: draft.trim() ? 1 : 0.45
          }}
        >
          ↑
        </button>
      </form>
    </>
  );
}
