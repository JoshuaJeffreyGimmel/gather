import express from 'express';
import crypto from 'node:crypto';
import { db, uid, nowISO, CATEGORIES } from './db.js';

const app = express();
app.use(express.json({ limit: '64kb' }));

// Permissive CORS for local dev; behind nginx the app is same-origin.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// --- queries ---------------------------------------------------------------
const qUserByPhone = db.prepare('SELECT * FROM users WHERE phone = ?');
const qUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const qUserByRef = db.prepare('SELECT * FROM users WHERE referralCode = ?');
const qSession = db.prepare('SELECT * FROM sessions WHERE token = ?');
const qActivity = db.prepare('SELECT * FROM activities WHERE id = ?');
const qActivities = db.prepare('SELECT * FROM activities ORDER BY startTime ASC');
const qMembers = db.prepare(`SELECT u.*, m.joinedAt AS mJoinedAt, m.sharePaid AS mSharePaid
  FROM memberships m JOIN users u ON u.id = m.userId
  WHERE m.activityId = ? AND m.status = 'joined' ORDER BY m.joinedAt ASC`);
const qMembership = db.prepare("SELECT * FROM memberships WHERE activityId = ? AND userId = ? AND status = 'joined'");
const qMyMemberships = db.prepare("SELECT * FROM memberships WHERE userId = ? AND status = 'joined'");
const qMessages = db.prepare('SELECT * FROM messages WHERE activityId = ? ORDER BY createdAt ASC, rowid ASC');
const qMyRating = db.prepare('SELECT * FROM ratings WHERE activityId = ? AND userId = ?');
const qRatings = db.prepare('SELECT * FROM ratings WHERE activityId = ?');
const qReferrals = db.prepare('SELECT * FROM referrals WHERE inviterId = ? ORDER BY createdAt DESC');

// --- helpers ---------------------------------------------------------------
class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const fail = (status, code) => { throw new HttpError(status, code); };

const normalisePhone = (raw) => {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith('0')) return '+41' + digits.slice(1);
  return '+41' + digits;
};

const money = (n) => Math.round(n * 100) / 100;

// The exact meeting point is a reward for saying yes. Before that, everyone
// only gets the neighbourhood — including on the map, where the pin is snapped
// to a ~250 m grid so it cannot be reverse-engineered.
const BLUR = 0.004;
const blur = (v, salt) => {
  const h = crypto.createHash('sha256').update(salt).digest()[0] / 255 - 0.5;
  return Math.round((v + h * BLUR) / BLUR) * BLUR;
};

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, age: u.age, city: u.city, avatar: u.avatar,
    verified: !!u.verified,
    stats: { meetupsJoined: u.meetupsJoined, meetupsOrganized: u.meetupsOrganized, showUpRate: u.showUpRate }
  };
}

function meUser(u) {
  return {
    ...publicUser(u),
    phone: u.phone, verifiedAt: u.verifiedAt, referralCode: u.referralCode, createdAt: u.createdAt
  };
}

function activityJson(a, me) {
  const members = qMembers.all(a.id);
  const isOrganizer = !!me && me.id === a.organizerId;
  const isJoined = !!me && members.some((m) => m.id === me.id);
  const revealed = isOrganizer || isJoined;
  const mine = me ? qMembership.get(a.id, me.id) : null;
  const myRating = me ? qMyRating.get(a.id, me.id) : null;
  const ratings = qRatings.all(a.id);
  const perPerson = money((a.costTotal || 0) / a.maxPeople);

  return {
    id: a.id,
    category: a.category,
    title: a.title,
    description: a.description,
    startTime: a.startTime,
    endTime: a.endTime,
    areaLabel: a.areaLabel,
    photo: a.photo,
    // Trust mechanic: precise location only after joining.
    locationRevealed: revealed,
    locationName: revealed ? a.locationName : null,
    address: revealed ? a.address : null,
    locationHint: revealed ? a.locationHint : null,
    lat: revealed ? a.lat : blur(a.lat, a.id + 'lat'),
    lng: revealed ? a.lng : blur(a.lng, a.id + 'lng'),
    maxPeople: a.maxPeople,
    verifiedOnly: !!a.verifiedOnly,
    costTotal: a.costTotal,
    costPerPerson: perPerson,
    costNote: a.costNote,
    createdAt: a.createdAt,
    organizer: publicUser(qUserById.get(a.organizerId)),
    participants: members.map((m) => ({ ...publicUser(m), joinedAt: m.mJoinedAt, sharePaid: !!m.mSharePaid })),
    memberCount: members.length,
    spotsFree: Math.max(0, a.maxPeople - members.length),
    paidCount: members.filter((m) => m.mSharePaid).length,
    isJoined,
    isOrganizer,
    isPast: new Date(a.endTime || a.startTime).getTime() < Date.now(),
    mySharePaid: mine ? !!mine.sharePaid : false,
    myRating: myRating
      ? { stars: myRating.stars, tags: JSON.parse(myRating.tags || '[]'), allShowedUp: !!myRating.allShowedUp }
      : null,
    ratingCount: ratings.length,
    ratingAvg: ratings.length ? money(ratings.reduce((s, r) => s + r.stars, 0) / ratings.length) : null
  };
}

function messageJson(m) {
  return {
    id: m.id, kind: m.kind, text: m.text, createdAt: m.createdAt,
    author: m.userId ? publicUser(qUserById.get(m.userId)) : null
  };
}

function systemMessage(activityId, text) {
  db.prepare('INSERT INTO messages (id, activityId, userId, kind, text, createdAt) VALUES (?, ?, NULL, ?, ?, ?)')
    .run(uid(), activityId, 'system', text, nowISO());
}

function currentUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  if (!token) return null;
  const s = qSession.get(token);
  return s ? qUserById.get(s.userId) || null : null;
}

// Attaches req.user when a valid token is present; never rejects.
function optionalAuth(req, _res, next) { req.user = currentUser(req); next(); }

// Rejects without a valid token.
function auth(req, _res, next) {
  req.user = currentUser(req);
  if (!req.user) return next(new HttpError(401, 'unauthorized'));
  next();
}

// Wraps an async/throwing handler so `fail()` lands in the error middleware.
const route = (fn) => (req, res, next) => {
  try { Promise.resolve(fn(req, res)).catch(next); } catch (e) { next(e); }
};

// --- auth ------------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: nowISO() }));

// 1. Ask for an SMS code. There is no SMS gateway in the demo, so the code
//    comes back in the response and is also printed to the server log.
app.post('/api/auth/request-code', route((req, res) => {
  const phone = normalisePhone(req.body?.phone);
  if (!phone || phone.length < 8) fail(400, 'invalid_phone');
  const code = '123456';
  db.prepare('INSERT INTO codes (phone, code, createdAt) VALUES (?, ?, ?) ON CONFLICT(phone) DO UPDATE SET code = excluded.code, createdAt = excluded.createdAt')
    .run(phone, code, nowISO());
  console.log(`[auth] code for ${phone}: ${code}`);
  res.json({ ok: true, phone, devCode: code });
}));

// 2. Exchange the code for a session token. Any six digits are accepted in the
//    demo; an unknown number is signed up on the spot.
app.post('/api/auth/verify-code', route((req, res) => {
  const phone = normalisePhone(req.body?.phone);
  const code = String(req.body?.code || '').replace(/\D/g, '');
  if (!phone) fail(400, 'invalid_phone');
  if (code.length !== 6) fail(400, 'invalid_code');

  let user = qUserByPhone.get(phone);
  let isNew = false;
  if (!user) {
    isNew = true;
    const id = uid();
    const name = String(req.body?.name || '').trim() || 'Gast';
    const ref = 'GATHER-' + crypto.randomBytes(2).toString('hex').toUpperCase();
    db.prepare(`INSERT INTO users (id, phone, name, age, city, avatar, verified, meetupsJoined, meetupsOrganized, showUpRate, referralCode, createdAt)
      VALUES (?, ?, ?, NULL, 'Zürich', NULL, 0, 0, 0, 100, ?, ?)`).run(id, phone, name, ref, nowISO());
    user = qUserById.get(id);
  }
  db.prepare('DELETE FROM codes WHERE phone = ?').run(phone);

  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, userId, createdAt) VALUES (?, ?, ?)').run(token, user.id, nowISO());
  res.json({ token, isNew, user: meUser(user) });
}));

// 3. The ID scan. Mocked: flipping the flag is the whole point of the screen.
app.post('/api/me/verify-id', auth, route((req, res) => {
  db.prepare('UPDATE users SET verified = 1, verifiedAt = ? WHERE id = ?').run(nowISO(), req.user.id);
  // A pending referral for this number turns into a rewarded one.
  db.prepare("UPDATE referrals SET status = 'verified' WHERE inviteeId = ? AND status = 'pending'").run(req.user.id);
  res.json({ user: meUser(qUserById.get(req.user.id)) });
}));

// 4. Who am I.
app.get('/api/me', auth, route((req, res) => res.json({ user: meUser(req.user) })));

app.post('/api/me', auth, route((req, res) => {
  const name = String(req.body?.name || '').trim();
  const age = req.body?.age == null ? null : Number(req.body.age);
  const city = String(req.body?.city || '').trim();
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  if (Number.isFinite(age) && age > 0) db.prepare('UPDATE users SET age = ? WHERE id = ?').run(age, req.user.id);
  if (city) db.prepare('UPDATE users SET city = ? WHERE id = ?').run(city, req.user.id);
  res.json({ user: meUser(qUserById.get(req.user.id)) });
}));

app.post('/api/auth/logout', auth, route((req, res) => {
  const token = (req.headers.authorization || '').slice(7).trim();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ ok: true });
}));

// --- activities ------------------------------------------------------------
// 5. The Discover board.
app.get('/api/activities', optionalAuth, route((req, res) => {
  const category = req.query.category;
  const scope = req.query.scope; // 'upcoming' (default) | 'all'
  const now = Date.now();
  let list = qActivities.all();
  if (scope !== 'all') list = list.filter((a) => new Date(a.endTime || a.startTime).getTime() >= now);
  if (category && category !== 'Alle') {
    if (!CATEGORIES.includes(category)) fail(400, 'unknown_category');
    list = list.filter((a) => a.category === category);
  }
  res.json({
    activities: list.map((a) => activityJson(a, req.user)),
    categories: CATEGORIES,
    total: list.length
  });
}));

// 6. One activity.
app.get('/api/activities/:id', optionalAuth, route((req, res) => {
  const a = qActivity.get(req.params.id) || fail(404, 'not_found');
  res.json({ activity: activityJson(a, req.user) });
}));

// 7. Create one. The organiser is joined automatically.
app.post('/api/activities', auth, route((req, res) => {
  if (!req.user.verified) fail(403, 'verification_required');
  const b = req.body || {};
  const category = CATEGORIES.includes(b.category) ? b.category : fail(400, 'unknown_category');
  const title = String(b.title || '').trim() || fail(400, 'title_required');
  const startTime = new Date(b.startTime);
  if (Number.isNaN(startTime.getTime())) fail(400, 'invalid_start_time');
  const maxPeople = Math.min(6, Math.max(3, Number(b.maxPeople) || 6));
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) fail(400, 'invalid_location');

  const id = uid();
  db.prepare(`INSERT INTO activities
    (id, organizerId, category, title, description, startTime, endTime, areaLabel, locationName, address, locationHint, lat, lng, photo, maxPeople, verifiedOnly, costTotal, costNote, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, req.user.id, category, title.slice(0, 120), String(b.description || '').slice(0, 2000),
    startTime.toISOString(),
    b.endTime ? new Date(b.endTime).toISOString() : new Date(startTime.getTime() + 90 * 60000).toISOString(),
    String(b.areaLabel || 'Zürich'), String(b.locationName || 'Treffpunkt'), String(b.address || ''),
    String(b.locationHint || ''), lat, lng, b.photo || null, maxPeople,
    b.verifiedOnly === false ? 0 : 1, Math.max(0, Number(b.costTotal) || 0), String(b.costNote || ''), nowISO()
  );
  db.prepare("INSERT INTO memberships (id, activityId, userId, status, joinedAt, sharePaid) VALUES (?, ?, ?, 'joined', ?, 0)")
    .run(uid(), id, req.user.id, nowISO());
  db.prepare('UPDATE users SET meetupsOrganized = meetupsOrganized + 1 WHERE id = ?').run(req.user.id);
  systemMessage(id, `${req.user.name} hat die Aktivität erstellt`);
  res.status(201).json({ activity: activityJson(qActivity.get(id), qUserById.get(req.user.id)) });
}));

// 8. Say yes. This is where verification, capacity and the address gate meet.
app.post('/api/activities/:id/join', auth, route((req, res) => {
  const a = qActivity.get(req.params.id) || fail(404, 'not_found');
  if (a.verifiedOnly && !req.user.verified) fail(403, 'verification_required');
  if (new Date(a.endTime || a.startTime).getTime() < Date.now()) fail(409, 'already_over');
  if (qMembership.get(a.id, req.user.id)) fail(409, 'already_joined');
  if (qMembers.all(a.id).length >= a.maxPeople) fail(409, 'activity_full');

  db.prepare("INSERT INTO memberships (id, activityId, userId, status, joinedAt, sharePaid) VALUES (?, ?, ?, 'joined', ?, 0) ON CONFLICT(activityId, userId) DO UPDATE SET status = 'joined', joinedAt = excluded.joinedAt")
    .run(uid(), a.id, req.user.id, nowISO());
  db.prepare('UPDATE users SET meetupsJoined = meetupsJoined + 1 WHERE id = ?').run(req.user.id);
  systemMessage(a.id, `${req.user.name} ist beigetreten · verifiziert`);
  res.json({ activity: activityJson(qActivity.get(a.id), qUserById.get(req.user.id)) });
}));

// 9. Take it back.
app.post('/api/activities/:id/leave', auth, route((req, res) => {
  const a = qActivity.get(req.params.id) || fail(404, 'not_found');
  if (a.organizerId === req.user.id) fail(409, 'organizer_cannot_leave');
  if (!qMembership.get(a.id, req.user.id)) fail(409, 'not_joined');

  db.prepare('DELETE FROM memberships WHERE activityId = ? AND userId = ?').run(a.id, req.user.id);
  db.prepare('UPDATE users SET meetupsJoined = MAX(0, meetupsJoined - 1) WHERE id = ?').run(req.user.id);
  systemMessage(a.id, `${req.user.name} hat abgesagt`);
  res.json({ activity: activityJson(qActivity.get(a.id), qUserById.get(req.user.id)) });
}));

// 10. Chat history. `since` makes this cheap to poll.
app.get('/api/activities/:id/messages', auth, route((req, res) => {
  const a = qActivity.get(req.params.id) || fail(404, 'not_found');
  if (!qMembership.get(a.id, req.user.id)) fail(403, 'join_required');
  let rows = qMessages.all(a.id);
  const since = req.query.since;
  if (since) rows = rows.filter((m) => m.createdAt > since);
  res.json({ messages: rows.map(messageJson) });
}));

// 11. Say something. Only people who committed can post.
app.post('/api/activities/:id/messages', auth, route((req, res) => {
  const a = qActivity.get(req.params.id) || fail(404, 'not_found');
  if (!qMembership.get(a.id, req.user.id)) fail(403, 'join_required');
  const text = String(req.body?.text || '').trim();
  if (!text) fail(400, 'empty_message');

  const id = uid();
  db.prepare('INSERT INTO messages (id, activityId, userId, kind, text, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, a.id, req.user.id, 'msg', text.slice(0, 1000), nowISO());
  res.status(201).json({ message: messageJson(db.prepare('SELECT * FROM messages WHERE id = ?').get(id)) });
}));

// 12. Rate it afterwards. Anonymous by design — we store who rated only to
//     stop double votes, and never hand that back out.
app.post('/api/activities/:id/rate', auth, route((req, res) => {
  const a = qActivity.get(req.params.id) || fail(404, 'not_found');
  if (!qMembership.get(a.id, req.user.id)) fail(403, 'join_required');
  if (new Date(a.endTime || a.startTime).getTime() > Date.now()) fail(409, 'not_over_yet');
  const stars = Math.round(Number(req.body?.stars));
  if (!(stars >= 1 && stars <= 5)) fail(400, 'invalid_stars');
  const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(String).slice(0, 8) : [];
  const allShowedUp = req.body?.allShowedUp ? 1 : 0;

  db.prepare(`INSERT INTO ratings (id, activityId, userId, stars, tags, allShowedUp, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(activityId, userId) DO UPDATE SET stars = excluded.stars, tags = excluded.tags, allShowedUp = excluded.allShowedUp, createdAt = excluded.createdAt`)
    .run(uid(), a.id, req.user.id, stars, JSON.stringify(tags), allShowedUp, nowISO());
  res.json({ activity: activityJson(qActivity.get(a.id), req.user) });
}));

// 13. Send your share. A payment mock: no PSP, just the split being settled.
app.post('/api/activities/:id/pay', auth, route((req, res) => {
  const a = qActivity.get(req.params.id) || fail(404, 'not_found');
  const mine = qMembership.get(a.id, req.user.id) || fail(403, 'join_required');
  if (mine.sharePaid) fail(409, 'already_paid');
  if (!a.costTotal) fail(409, 'nothing_to_pay');

  db.prepare('UPDATE memberships SET sharePaid = 1 WHERE activityId = ? AND userId = ?').run(a.id, req.user.id);
  res.json({ activity: activityJson(qActivity.get(a.id), req.user), paid: money(a.costTotal / a.maxPeople) });
}));

// --- me --------------------------------------------------------------------
// 14. Everything Lena said yes to, split into what is next and what is done.
app.get('/api/me/meetups', auth, route((req, res) => {
  const ids = new Set(qMyMemberships.all(req.user.id).map((m) => m.activityId));
  const mine = qActivities.all().filter((a) => ids.has(a.id)).map((a) => activityJson(a, req.user));
  res.json({
    upcoming: mine.filter((a) => !a.isPast),
    past: mine.filter((a) => a.isPast).reverse(),
    // The one the Reminder + Confirmed-meetup screens are about.
    next: mine.find((a) => !a.isPast) || null,
    // The one still waiting for a rating.
    toRate: mine.filter((a) => a.isPast && !a.myRating).reverse()[0] || null
  });
}));

// Chat list: one row per meetup Lena is in, newest activity first.
app.get('/api/me/chats', auth, route((req, res) => {
  const ids = new Set(qMyMemberships.all(req.user.id).map((m) => m.activityId));
  const chats = qActivities.all().filter((a) => ids.has(a.id)).map((a) => {
    const rows = qMessages.all(a.id);
    const last = rows[rows.length - 1];
    return {
      activity: activityJson(a, req.user),
      lastMessage: last ? messageJson(last) : null,
      messageCount: rows.length
    };
  });
  chats.sort((x, y) => {
    const t = (c) => new Date(c.lastMessage?.createdAt || c.activity.createdAt).getTime();
    return t(y) - t(x);
  });
  res.json({ chats });
}));

// Referral programme: the code, the progress bar and who used it.
app.get('/api/me/referrals', auth, route((req, res) => {
  const rows = qReferrals.all(req.user.id);
  const verified = rows.filter((r) => r.status === 'verified').length;
  res.json({
    code: req.user.referralCode,
    goal: 3,
    verified,
    invites: rows.map((r) => ({
      id: r.id, name: r.inviteeName, avatar: r.inviteeAvatar, status: r.status, createdAt: r.createdAt
    }))
  });
}));

// Redeeming someone's code. The reward only lands once the invitee is verified.
app.post('/api/referrals/redeem', auth, route((req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) fail(400, 'code_required');
  if (code === req.user.referralCode) fail(409, 'own_code');
  const inviter = qUserByRef.get(code) || fail(404, 'unknown_code');
  const already = db.prepare('SELECT 1 FROM referrals WHERE inviteeId = ?').get(req.user.id);
  if (already) fail(409, 'already_redeemed');

  db.prepare('INSERT INTO referrals (id, inviterId, inviteeId, inviteeName, inviteeAvatar, code, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(uid(), inviter.id, req.user.id, req.user.name, req.user.avatar,
      code, req.user.verified ? 'verified' : 'pending', nowISO());
  res.json({ ok: true, inviter: publicUser(inviter), status: req.user.verified ? 'verified' : 'pending' });
}));

// --- errors ----------------------------------------------------------------
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
  console.error('[error]', err);
  res.status(500).json({ error: 'server_error' });
});

const PORT = Number(process.env.PORT) || 4000;
const server = app.listen(PORT, '0.0.0.0', () => console.log(`[gather] API listening on :${PORT}`));

// `docker compose down` sends SIGTERM: finish in-flight requests, checkpoint
// the WAL and close the database rather than being killed mid-write.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[gather] ${signal} — shutting down`);
    server.close(() => {
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        db.close();
      } catch (e) {
        console.error('[gather] close failed', e);
      }
      process.exit(0);
    });
    // Don't hang forever on a stuck connection.
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
