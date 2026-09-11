// End-to-end check of the whole demo loop against a running API.
//   node scripts/smoke.mjs [baseUrl]
// Exits non-zero on the first failed assertion.
const BASE = process.argv[2] || process.env.API || 'http://127.0.0.1:4000';

let passed = 0;
const fails = [];
function ok(label, cond, detail) {
  if (cond) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  else { fails.push(label); console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ' → ' + JSON.stringify(detail) : ''}`); }
}
const step = (n) => console.log(`\n\x1b[1m${n}\x1b[0m`);

let token = null;
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json };
}

step('Health');
{
  const r = await api('GET', '/api/health');
  ok('GET /api/health → 200 ok', r.status === 200 && r.body?.ok === true, r.body);
}

step('Anonymous discover hides the exact address');
let targetId = null;
{
  const r = await api('GET', '/api/activities');
  ok('GET /api/activities → 200', r.status === 200, r.status);
  ok('board is seeded', r.body.activities.length >= 8, r.body.activities?.length);
  ok('all six categories offered', r.body.categories.length === 6, r.body.categories);
  const a = r.body.activities[0];
  ok('anonymous sees the area label', typeof a.areaLabel === 'string' && a.areaLabel.length > 0, a.areaLabel);
  ok('anonymous does NOT see the address', a.address === null && a.locationName === null, a);
  ok('anonymous map pin is blurred', a.locationRevealed === false, a.locationRevealed);
  const cat = await api('GET', '/api/activities?category=Sport');
  ok('category filter works', cat.body.activities.every((x) => x.category === 'Sport'), cat.body.activities?.map((x) => x.category));
  const bad = await api('GET', '/api/activities?category=Nope');
  ok('unknown category → 400', bad.status === 400, bad.status);
}

step('Phone login');
{
  const req = await api('POST', '/api/auth/request-code', { phone: '079 000 00 00' });
  ok('request-code normalises the number', req.body?.phone === '+41790000000', req.body);
  ok('request-code returns the dev code', req.body?.devCode === '123456', req.body);
  const bad = await api('POST', '/api/auth/verify-code', { phone: '+41790000000', code: '12' });
  ok('short code → 400', bad.status === 400, bad.status);
  const ver = await api('POST', '/api/auth/verify-code', { phone: '+41790000000', code: '123456' });
  ok('verify-code returns a token', typeof ver.body?.token === 'string', ver.body);
  ok('lands on the seeded demo profile', ver.body?.user?.name === 'Lena M.', ver.body?.user);
  token = ver.body.token;
  const me = await api('GET', '/api/me');
  ok('GET /api/me → the same user', me.body?.user?.id === ver.body.user.id, me.body);
  ok('demo user is already verified', me.body?.user?.verified === true, me.body?.user);
}

step('ID verification (mock)');
{
  const r = await api('POST', '/api/me/verify-id');
  ok('verify-id → verified', r.status === 200 && r.body.user.verified === true, r.body);
  ok('verify-id stamps a date', !!r.body.user.verifiedAt, r.body.user);
}

step('Joining reveals the meeting point');
{
  const list = await api('GET', '/api/activities');
  const target = list.body.activities.find((a) => !a.isJoined && a.spotsFree > 0);
  ok('found an activity to join', !!target, list.body.activities.map((a) => [a.title, a.isJoined, a.spotsFree]));
  targetId = target.id;

  const before = await api('GET', '/api/activities/' + targetId);
  ok('before joining: no address', before.body.activity.address === null, before.body.activity.address);
  const blurredLat = before.body.activity.lat;

  const join = await api('POST', `/api/activities/${targetId}/join`);
  ok('join → 200', join.status === 200, join.body);
  ok('after joining: isJoined', join.body.activity.isJoined === true, join.body.activity.isJoined);
  ok('after joining: address revealed', typeof join.body.activity.address === 'string' && join.body.activity.address.length > 0, join.body.activity.address);
  ok('after joining: locationHint revealed', join.body.activity.locationHint !== null, join.body.activity.locationHint);
  ok('after joining: exact pin differs from blurred pin', join.body.activity.lat !== blurredLat, [blurredLat, join.body.activity.lat]);

  const again = await api('POST', `/api/activities/${targetId}/join`);
  ok('double join → 409 already_joined', again.status === 409 && again.body.error === 'already_joined', again.body);

  const msgs = await api('GET', `/api/activities/${targetId}/messages`);
  const sys = msgs.body.messages.filter((m) => m.kind === 'system');
  ok('join wrote a system message', sys.some((m) => m.text.includes('Lena M.') && m.text.includes('beigetreten')), sys.map((m) => m.text));
}

step('Capacity and verification gates');
{
  const list = await api('GET', '/api/activities?scope=all');
  const full = list.body.activities.find((a) => a.spotsFree === 0 && !a.isJoined && !a.isPast);
  if (full) {
    const r = await api('POST', `/api/activities/${full.id}/join`);
    ok('full activity → 409 activity_full', r.status === 409 && r.body.error === 'activity_full', r.body);
  } else {
    ok('full activity → 409 activity_full (no full activity seeded; skipped)', true);
  }
  const past = list.body.activities.find((a) => a.isPast && !a.isJoined);
  if (past) {
    const r = await api('POST', `/api/activities/${past.id}/join`);
    ok('past activity → 409 already_over', r.status === 409 && r.body.error === 'already_over', r.body);
  } else {
    ok('past activity → 409 already_over (none joinable; skipped)', true);
  }
  const saved = token; token = null;
  const anon = await api('POST', `/api/activities/${targetId}/join`);
  ok('anonymous join → 401', anon.status === 401, anon.status);
  const anonMsgs = await api('GET', `/api/activities/${targetId}/messages`);
  ok('anonymous chat read → 401', anonMsgs.status === 401, anonMsgs.status);
  token = saved;
}

step('Group chat');
let lastAt = null;
{
  const first = await api('GET', `/api/activities/${targetId}/messages`);
  const before = first.body.messages.length;
  lastAt = first.body.messages[before - 1]?.createdAt;

  const empty = await api('POST', `/api/activities/${targetId}/messages`, { text: '   ' });
  ok('empty message → 400', empty.status === 400, empty.status);

  const post = await api('POST', `/api/activities/${targetId}/messages`, { text: 'Bin dabei. Kommt ihr mit dem 4er?' });
  ok('POST message → 201', post.status === 201, post.body);
  ok('message is attributed to me', post.body.message.author?.name === 'Lena M.', post.body.message.author);

  const poll = await api('GET', `/api/activities/${targetId}/messages?since=${encodeURIComponent(lastAt)}`);
  ok('?since returns only what is new', poll.body.messages.length === 1 && poll.body.messages[0].text.startsWith('Bin dabei'), poll.body.messages.map((m) => m.text));

  const all = await api('GET', `/api/activities/${targetId}/messages`);
  ok('history grew by one', all.body.messages.length === before + 1, [before, all.body.messages.length]);
}

step('Meetups, cost split and the payment mock');
let payId = null;
{
  const r = await api('GET', '/api/me/meetups');
  ok('GET /api/me/meetups → 200', r.status === 200, r.status);
  ok('has an upcoming meetup', r.body.upcoming.length > 0, r.body.upcoming?.length);
  ok('has a "next" meetup for the countdown', !!r.body.next, r.body.next?.title);
  ok('has a past meetup waiting to be rated', !!r.body.toRate, r.body.toRate?.title);

  const withCost = r.body.upcoming.find((a) => a.costTotal > 0 && !a.mySharePaid);
  ok('found a meetup with a split', !!withCost, r.body.upcoming.map((a) => [a.title, a.costTotal, a.mySharePaid]));
  payId = withCost.id;
  ok('per-person share = total ÷ places', withCost.costPerPerson === Math.round((withCost.costTotal / withCost.maxPeople) * 100) / 100, [withCost.costTotal, withCost.maxPeople, withCost.costPerPerson]);

  const pay = await api('POST', `/api/activities/${payId}/pay`);
  ok('pay → 200', pay.status === 200, pay.body);
  ok('pay marks my share settled', pay.body.activity.mySharePaid === true, pay.body.activity.mySharePaid);
  ok('pay returns the amount', pay.body.paid === withCost.costPerPerson, [pay.body.paid, withCost.costPerPerson]);
  const twice = await api('POST', `/api/activities/${payId}/pay`);
  ok('paying twice → 409 already_paid', twice.status === 409 && twice.body.error === 'already_paid', twice.body);
}

step('Rating a finished meetup');
{
  const meetups = await api('GET', '/api/me/meetups');
  const past = meetups.body.toRate;
  const early = await api('POST', `/api/activities/${meetups.body.next.id}/rate`, { stars: 5 });
  ok('rating a future meetup → 409 not_over_yet', early.status === 409 && early.body.error === 'not_over_yet', early.body);
  const bad = await api('POST', `/api/activities/${past.id}/rate`, { stars: 9 });
  ok('invalid stars → 400', bad.status === 400, bad.status);

  const rate = await api('POST', `/api/activities/${past.id}/rate`, { stars: 5, tags: ['Pünktlich', 'Gerne wieder'], allShowedUp: true });
  ok('rate → 200', rate.status === 200, rate.body);
  ok('my rating comes back', rate.body.activity.myRating?.stars === 5, rate.body.activity.myRating);
  ok('tags are stored', rate.body.activity.myRating?.tags.includes('Gerne wieder'), rate.body.activity.myRating?.tags);
  ok('average is aggregated', typeof rate.body.activity.ratingAvg === 'number', rate.body.activity.ratingAvg);

  const after = await api('GET', '/api/me/meetups');
  ok('rated meetup leaves the to-rate queue', after.body.toRate?.id !== past.id, after.body.toRate?.title);
}

step('Creating an activity');
let createdId = null;
{
  const bad = await api('POST', '/api/activities', { category: 'Tanzen', title: 'x', startTime: new Date().toISOString(), lat: 47, lng: 8 });
  ok('unknown category → 400', bad.status === 400, bad.body);
  const noLoc = await api('POST', '/api/activities', { category: 'Sport', title: 'x', startTime: new Date().toISOString() });
  ok('missing location → 400', noLoc.status === 400, noLoc.body);

  const r = await api('POST', '/api/activities', {
    category: 'Outdoor', title: 'Feierabend-Schwimmen im Oberen Letten',
    description: 'Kurz rein, kurz raus, danach ein Glace.',
    startTime: new Date(Date.now() + 6 * 3600e3).toISOString(),
    areaLabel: 'Oberer Letten, Kreis 5', locationName: 'Flussbad Oberer Letten',
    address: 'Lettensteg 10, 8037 Zürich', locationHint: 'Beim Sprungturm',
    lat: 47.38607, lng: 8.53398, maxPeople: 5, costTotal: 0
  });
  ok('create → 201', r.status === 201, r.body);
  createdId = r.body.activity.id;
  ok('creator is the organiser', r.body.activity.isOrganizer === true, r.body.activity.isOrganizer);
  ok('creator is joined automatically', r.body.activity.isJoined === true && r.body.activity.memberCount === 1, r.body.activity.memberCount);
  ok('organiser sees the address', r.body.activity.address === 'Lettensteg 10, 8037 Zürich', r.body.activity.address);
  ok('maxPeople is clamped into 3–6', r.body.activity.maxPeople === 5, r.body.activity.maxPeople);
  const clamp = await api('POST', '/api/activities', {
    category: 'Gaming', title: 'Zu gross', startTime: new Date(Date.now() + 7 * 3600e3).toISOString(),
    lat: 47.37, lng: 8.53, maxPeople: 99
  });
  ok('maxPeople 99 → clamped to 6', clamp.body.activity.maxPeople === 6, clamp.body.activity.maxPeople);

  const leave = await api('POST', `/api/activities/${createdId}/leave`);
  ok('organiser cannot leave → 409', leave.status === 409 && leave.body.error === 'organizer_cannot_leave', leave.body);

  const board = await api('GET', '/api/activities');
  ok('new activity shows up on the board', board.body.activities.some((a) => a.id === createdId), createdId);
}

step('Leaving');
{
  const r = await api('POST', `/api/activities/${targetId}/leave`);
  ok('leave → 200', r.status === 200, r.body);
  ok('after leaving: address hidden again', r.body.activity.address === null, r.body.activity.address);
  ok('after leaving: isJoined false', r.body.activity.isJoined === false, r.body.activity.isJoined);
  const chat = await api('GET', `/api/activities/${targetId}/messages`);
  ok('after leaving: chat closed → 403', chat.status === 403 && chat.body.error === 'join_required', chat.body);
  const again = await api('POST', `/api/activities/${targetId}/leave`);
  ok('leaving twice → 409 not_joined', again.status === 409 && again.body.error === 'not_joined', again.body);
}

step('Referral programme');
{
  const r = await api('GET', '/api/me/referrals');
  ok('GET /api/me/referrals → 200', r.status === 200, r.status);
  ok('has a personal code', typeof r.body.code === 'string' && r.body.code.length > 0, r.body.code);
  ok('goal is 3 invites', r.body.goal === 3, r.body.goal);
  ok('counts the verified invites', typeof r.body.verified === 'number', r.body.verified);
  ok('lists the invites', Array.isArray(r.body.invites) && r.body.invites.length > 0, r.body.invites?.length);

  const own = await api('POST', '/api/referrals/redeem', { code: r.body.code });
  ok('own code → 409', own.status === 409 && own.body.error === 'own_code', own.body);
  const unknown = await api('POST', '/api/referrals/redeem', { code: 'NOPE-0000' });
  ok('unknown code → 404', unknown.status === 404, unknown.status);
}

step('Signup of a brand-new number');
{
  const saved = token;
  const phone = '+4179' + String(Date.now()).slice(-7);
  await api('POST', '/api/auth/request-code', { phone });
  const ver = await api('POST', '/api/auth/verify-code', { phone, code: '424242', name: 'Neu' });
  ok('new number is signed up', ver.body.isNew === true, ver.body);
  ok('new user starts unverified', ver.body.user.verified === false, ver.body.user);
  token = ver.body.token;

  const join = await api('POST', `/api/activities/${targetId}/join`);
  ok('unverified join → 403 verification_required', join.status === 403 && join.body.error === 'verification_required', join.body);
  const create = await api('POST', '/api/activities', { category: 'Sport', title: 'x', startTime: new Date(Date.now() + 3600e3).toISOString(), lat: 47.37, lng: 8.53 });
  ok('unverified create → 403 verification_required', create.status === 403 && create.body.error === 'verification_required', create.body);

  await api('POST', '/api/me/verify-id');
  const join2 = await api('POST', `/api/activities/${targetId}/join`);
  ok('after ID scan the join goes through', join2.status === 200, join2.body);

  const out = await api('POST', '/api/auth/logout');
  ok('logout → 200', out.status === 200, out.status);
  const dead = await api('GET', '/api/me');
  ok('token is dead after logout → 401', dead.status === 401, dead.status);
  token = saved;
}

step('Unknown routes');
{
  const r = await api('GET', '/api/nope');
  ok('unknown API route → 404 json', r.status === 404 && r.body?.error === 'not_found', r.body);
}

console.log(`\n\x1b[1m${fails.length ? '\x1b[31mFAILED' : '\x1b[32mPASSED'}\x1b[0m  ${passed} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log('  · ' + f)); process.exit(1); }
