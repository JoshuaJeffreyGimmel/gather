import { dayNumber, dayName, time, timeSpan } from '../format';
import { photoPosition, photoUrl } from '../photos';
import type { Activity } from '../types';
import { AvatarStack, Pill, Tick, VerifiedOnlyPill } from './Ui';

/** Spot counter — the last place turns red, a full activity says so. */
export function Spots({ activity, light = false }: { activity: Activity; light?: boolean }) {
  const { spotsFree, maxPeople } = activity;
  if (spotsFree === 0) {
    return <span style={{ fontSize: 11.5, fontWeight: 650, color: light ? 'rgba(251,247,241,.72)' : 'var(--muted)' }}>Ausgebucht</span>;
  }
  const urgent = spotsFree === 1;
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 650,
        color: urgent ? 'var(--red)' : light ? 'var(--cream)' : 'var(--ink)'
      }}
    >
      {spotsFree} von {maxPeople} {light ? 'Plätzen frei' : 'frei'}
    </span>
  );
}

/** The big photo card at the top of the board. */
export function FeaturedCard({ activity, onOpen }: { activity: Activity; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="photo tap"
      style={{ height: 224, borderRadius: 26, boxShadow: 'var(--photo-lift)', width: '100%', textAlign: 'left' }}
    >
      {activity.photo ? (
        <img src={photoUrl(activity.photo)} alt="" style={{ objectPosition: photoPosition(activity.photo) }} />
      ) : (
        <span style={{ position: 'absolute', inset: 0, background: 'var(--grad-150)' }} />
      )}
      <span
        className="photo__scrim"
        style={{
          background:
            'linear-gradient(180deg,rgba(23,19,15,.55) 0%,rgba(23,19,15,.1) 24%,rgba(23,19,15,.5) 54%,rgba(23,19,15,.86) 78%,rgba(23,19,15,.96) 100%)'
        }}
      />
      <span className="label label--lg" style={{ position: 'absolute', top: 14, left: 15, color: 'var(--cream)' }}>
        Als Nächstes · {dayName(activity.startTime)}
      </span>
      {activity.verifiedOnly && (
        <span style={{ position: 'absolute', top: 12, right: 13 }}>
          <VerifiedOnlyPill />
        </span>
      )}
      <span style={{ position: 'absolute', left: 15, right: 15, bottom: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <span>
          <span
            className="display"
            style={{ display: 'block', fontSize: 26, lineHeight: 1.08, color: 'var(--cream)', textShadow: '0 1px 14px rgba(23,19,15,.45)' }}
          >
            {activity.title}
          </span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 12.5, color: 'rgba(251,247,241,.82)' }}>
            {timeSpan(activity.startTime, activity.endTime)} · {activity.areaLabel}
          </span>
        </span>
        <span className="row row--between">
          <AvatarStack users={activity.participants} size={26} ring="#171310" />
          <Spots activity={activity} light />
        </span>
      </span>
    </button>
  );
}

/** A row on the board: photo or date tile, then the essentials. */
export function ActivityRow({ activity, onOpen }: { activity: Activity; onOpen: () => void }) {
  const ink = activity.category === 'Kino' || activity.category === 'Gaming';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card tap"
      style={{ display: 'flex', gap: 14, padding: 14, width: '100%', textAlign: 'left', alignItems: 'stretch' }}
    >
      {activity.photo ? (
        <img
          className="avatar--square"
          src={photoUrl(activity.photo)}
          alt=""
          loading="lazy"
          style={{ width: 74, height: 88, borderRadius: 16, objectFit: 'cover', objectPosition: photoPosition(activity.photo), flex: 'none' }}
        />
      ) : (
        <span
          className={`datetile${ink ? ' datetile--ink' : ''}`}
          style={{ width: 74, height: 88, borderRadius: 16, fontSize: 26 }}
          aria-hidden="true"
        >
          {dayNumber(activity.startTime)}
        </span>
      )}

      <span className="grow col" style={{ gap: 5, justifyContent: 'center' }}>
        <span className="label">
          {activity.category} · {dayName(activity.startTime)} {time(activity.startTime)}
        </span>
        <span style={{ fontSize: 16, fontWeight: 650, letterSpacing: '-0.01em' }}>{activity.title}</span>
        <span style={{ fontSize: 12, color: 'var(--grey)' }} className="truncate">
          {activity.areaLabel}
        </span>
        <span className="row row--between" style={{ marginTop: 2, gap: 8 }}>
          {activity.isJoined ? (
            <Pill variant="ink" tick>
              Zugesagt
            </Pill>
          ) : activity.spotsFree === 1 && activity.verifiedOnly ? (
            <VerifiedOnlyPill variant="ink" />
          ) : (
            <AvatarStack users={activity.participants} size={22} ring="#fff" overlap={-8} max={4} />
          )}
          <Spots activity={activity} />
        </span>
      </span>
    </button>
  );
}

/** Compact row used under the map and in lists of my own meetups. */
export function CompactRow({
  activity,
  onOpen,
  trailing
}: {
  activity: Activity;
  onOpen?: () => void;
  trailing?: React.ReactNode;
}) {
  const Tag = onOpen ? 'button' : 'div';
  return (
    <Tag
      {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})}
      className="card tap"
      style={{ display: 'flex', gap: 13, padding: 13, width: '100%', textAlign: 'left', alignItems: 'center' }}
    >
      {activity.photo ? (
        <img
          src={photoUrl(activity.photo)}
          alt=""
          loading="lazy"
          style={{ width: 62, height: 62, borderRadius: 14, objectFit: 'cover', objectPosition: photoPosition(activity.photo), flex: 'none' }}
        />
      ) : (
        <span className="datetile" style={{ width: 62, height: 62, borderRadius: 14, fontSize: 22 }} aria-hidden="true">
          {dayNumber(activity.startTime)}
        </span>
      )}
      <span className="grow col" style={{ gap: 4 }}>
        <span className="label">
          {activity.category} · {dayName(activity.startTime)} {time(activity.startTime)}
        </span>
        <span style={{ fontSize: 15.5, fontWeight: 650, letterSpacing: '-0.01em' }} className="truncate">
          {activity.title}
        </span>
        <span className="row row--between" style={{ gap: 8 }}>
          {activity.isPast ? (
            // Free places and the verified gate are meaningless once it is over.
            <span className="meta truncate" style={{ fontSize: 11.5 }}>
              {activity.memberCount} {activity.memberCount === 1 ? 'Person' : 'Personen'} · {activity.areaLabel}
            </span>
          ) : (
            <>
              {activity.verifiedOnly ? (
                <VerifiedOnlyPill variant="ink" />
              ) : (
                <span className="meta truncate" style={{ fontSize: 11.5 }}>{activity.areaLabel}</span>
              )}
              <Spots activity={activity} />
            </>
          )}
        </span>
      </span>
      {trailing}
    </Tag>
  );
}

/** "Alle vier sind verifiziert." — the participants block on the detail screen. */
export function WhoIsComing({ activity }: { activity: Activity }) {
  const count = activity.participants.length;
  const words = ['niemand', 'eine Person', 'beide', 'alle drei', 'alle vier', 'alle fünf', 'alle sechs'];
  const allVerified = activity.participants.every((p) => p.verified);
  return (
    <div>
      <span className="label">Wer kommt</span>
      <div className="row" style={{ marginTop: 11, gap: 12 }}>
        <AvatarStack users={activity.participants} size={44} ring="#FBF7F1" overlap={-11} badges max={5} />
        <span style={{ fontSize: 12.5, color: 'var(--grey)', lineHeight: 1.4 }}>
          {allVerified ? (
            <>
              {words[Math.min(count, 6)]} sind
              <br />
              verifiziert.
            </>
          ) : (
            <>
              {count} {count === 1 ? 'Person ist' : 'Personen sind'} dabei.
            </>
          )}
        </span>
      </div>
    </div>
  );
}

export function OrganizerRow({ activity }: { activity: Activity }) {
  const o = activity.organizer;
  return (
    <div className="row" style={{ gap: 11 }}>
      <img
        className="avatar"
        src={o.avatar ? `/img/${o.avatar}` : undefined}
        alt=""
        style={{ width: 40, height: 40 }}
      />
      <div className="col" style={{ gap: 2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 650 }}>
          {o.name}
          {o.verified && <Tick size="sm" />}
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          Organisator:in · {o.stats.meetupsJoined} Treffen · {o.stats.showUpRate} % erschienen
        </span>
      </div>
    </div>
  );
}
