import { useEffect, useState } from 'react';
import { api } from '../api';
import { ago, dayName, time } from '../format';
import { photoPosition, photoUrl } from '../photos';
import { useRouter } from '../router';
import { useSession } from '../session';
import type { ChatRow } from '../types';
import { Avatar, AvatarStack, EmptyState, StatusBar, TopFade } from '../components/Ui';

/** One chat per meetup — it exists for that evening and then becomes archive. */
export function Chats() {
  const { go } = useRouter();
  const { toastError } = useSession();
  const [rows, setRows] = useState<ChatRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    api.chats()
      .then((r) => { if (alive) setRows(r.chats); })
      .catch((e) => { if (alive) toastError(e); });
    return () => { alive = false; };
  }, [toastError]);

  return (
    <>
      <StatusBar />
      <TopFade />
      <div className="scroll" style={{ ['--pad-bottom' as string]: 'calc(var(--tabbar-h) + 16px)' }}>
        <div className="pad">
          <h1 className="display display--sm">Chats</h1>
          <p className="meta" style={{ marginTop: 7 }}>
            Jeder Chat gehört zu genau einem Treffen. Danach Archiv.
          </p>
        </div>

        {!rows ? (
          <div className="pad" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 78, borderRadius: 22 }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Noch keine Chats."
            body="Sobald du bei einer Aktivität zusagst, bekommst du den Gruppenchat dazu."
            action={
              <button className="btn btn--primary btn--sm" onClick={() => go('/')}>
                Aktivitäten entdecken
              </button>
            }
          />
        ) : (
          <div className="pad" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map(({ activity, lastMessage }) => (
              <button
                key={activity.id}
                className="card tap"
                style={{ display: 'flex', gap: 13, padding: 13, width: '100%', textAlign: 'left', alignItems: 'center' }}
                onClick={() => go(`/chats/${activity.id}`)}
              >
                {activity.photo ? (
                  <img
                    src={photoUrl(activity.photo)}
                    alt=""
                    loading="lazy"
                    style={{ width: 52, height: 52, borderRadius: 16, objectFit: 'cover', objectPosition: photoPosition(activity.photo), flex: 'none' }}
                  />
                ) : (
                  <span className="datetile" style={{ width: 52, height: 52, borderRadius: 16, fontSize: 20 }} aria-hidden="true">
                    {new Date(activity.startTime).getDate()}
                  </span>
                )}
                <span className="grow col" style={{ gap: 3 }}>
                  <span className="row row--between" style={{ gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 650 }} className="truncate">
                      {activity.title}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--faint)', flex: 'none' }}>
                      {lastMessage ? ago(lastMessage.createdAt) : ''}
                    </span>
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--grey)' }} className="truncate">
                    {lastMessage
                      ? lastMessage.kind === 'system'
                        ? lastMessage.text
                        : `${lastMessage.author?.name.split(' ')[0]}: ${lastMessage.text}`
                      : 'Noch keine Nachrichten'}
                  </span>
                  <span className="row row--between" style={{ gap: 8 }}>
                    <AvatarStack users={activity.participants} size={20} ring="#fff" overlap={-7} max={4} />
                    {/* The tick never appears on its own — here the row has no
                        room for a name beside it, so the time stands alone. */}
                    <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                      {activity.isPast ? 'Archiv' : `${dayName(activity.startTime)} ${time(activity.startTime)}`}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** Small helper reused by the chat header. */
export function ChatHeaderAvatars({ users }: { users: ChatRow['activity']['participants'] }) {
  return (
    <div className="stack" style={{ ['--overlap' as string]: '-9px', flex: 'none' }}>
      {users.slice(0, 3).map((u) => (
        <Avatar key={u.id} user={u} size={26} ring="#FBF7F1" />
      ))}
    </div>
  );
}
