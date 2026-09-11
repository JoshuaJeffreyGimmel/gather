import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'gather.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export const uid = () => crypto.randomUUID();
export const nowISO = () => new Date().toISOString();

export const CATEGORIES = ['Sport', 'Lernen', 'Kino', 'Gaming', 'Essen', 'Outdoor'];

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  age INTEGER,
  city TEXT DEFAULT 'Zürich',
  avatar TEXT,
  verified INTEGER DEFAULT 0,
  verifiedAt TEXT,
  meetupsJoined INTEGER DEFAULT 0,
  meetupsOrganized INTEGER DEFAULT 0,
  showUpRate INTEGER DEFAULT 100,
  referralCode TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  organizerId TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  startTime TEXT NOT NULL,
  endTime TEXT,
  areaLabel TEXT NOT NULL,
  locationName TEXT NOT NULL,
  address TEXT NOT NULL,
  locationHint TEXT DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  photo TEXT,
  maxPeople INTEGER NOT NULL DEFAULT 6,
  verifiedOnly INTEGER DEFAULT 1,
  costTotal REAL DEFAULT 0,
  costNote TEXT DEFAULT '',
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  activityId TEXT NOT NULL REFERENCES activities(id),
  userId TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'joined',
  joinedAt TEXT NOT NULL,
  sharePaid INTEGER DEFAULT 0,
  UNIQUE(activityId, userId)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  activityId TEXT NOT NULL REFERENCES activities(id),
  userId TEXT REFERENCES users(id),
  kind TEXT NOT NULL DEFAULT 'msg',
  text TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  activityId TEXT NOT NULL REFERENCES activities(id),
  userId TEXT NOT NULL REFERENCES users(id),
  stars INTEGER NOT NULL,
  tags TEXT DEFAULT '[]',
  allShowedUp INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL,
  UNIQUE(activityId, userId)
);
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  inviterId TEXT NOT NULL REFERENCES users(id),
  inviteeId TEXT REFERENCES users(id),
  inviteeName TEXT,
  inviteeAvatar TEXT,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id),
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS codes (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_activity ON messages(activityId, createdAt);
CREATE INDEX IF NOT EXISTS idx_mem_activity ON memberships(activityId);
CREATE INDEX IF NOT EXISTS idx_mem_user ON memberships(userId);
CREATE INDEX IF NOT EXISTS idx_act_start ON activities(startTime);
`);

// ---------------------------------------------------------------------------
// Seed data (first boot only). All times are relative to "now", so the demo
// always shows live countdowns, "Heute" labels and a meetup that is about to
// start. Coordinates are the real Zurich locations, for the Leaflet maps.
// ---------------------------------------------------------------------------

function at(dayOffset, h, m) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

// Today at h:m — or tomorrow, if that time is already more than 30 min past.
function soon(h, m) {
  const iso = at(0, h, m);
  return new Date(iso).getTime() < Date.now() - 30 * 60 * 1000 ? at(1, h, m) : iso;
}

// The confirmed meetup always sits ~2h14m out, so the countdown card is alive
// no matter when the demo is booted.
function inHours(hours) {
  const t = Date.now() + hours * 3600 * 1000;
  // Round to the nearest five minutes — a countdown is no excuse for 18:29.
  return new Date(Math.round(t / 300000) * 300000).toISOString();
}

const minsAgo = (n) => new Date(Date.now() - n * 60000).toISOString();

export function seedIfEmpty() {
  if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c > 0) return;

  const insertUser = db.prepare(`INSERT INTO users
    (id, phone, name, age, city, avatar, verified, verifiedAt, meetupsJoined, meetupsOrganized, showUpRate, referralCode, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`);
  const insertActivity = db.prepare(`INSERT INTO activities
    (id, organizerId, category, title, description, startTime, endTime, areaLabel, locationName, address, locationHint, lat, lng, photo, maxPeople, verifiedOnly, costTotal, costNote, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertMember = db.prepare(`INSERT INTO memberships (id, activityId, userId, status, joinedAt, sharePaid) VALUES (?, ?, ?, 'joined', ?, ?)`);
  const insertMessage = db.prepare(`INSERT INTO messages (id, activityId, userId, kind, text, createdAt) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertRating = db.prepare(`INSERT INTO ratings (id, activityId, userId, stars, tags, allShowedUp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const insertReferral = db.prepare(`INSERT INTO referrals (id, inviterId, inviteeId, inviteeName, inviteeAvatar, code, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  const joinedAt = at(-120, 9, 0);
  const verifiedAt = at(-120, 9, 40);
  const U = {
    // The demo login. +41 79 000 00 00 / any 6 digits.
    lena: { phone: '+41790000000', name: 'Lena M.', age: 23, city: 'Zürich, Kreis 4', avatar: 'avatar-lena.jpg', joined: 14, org: 4, rate: 100, ref: 'LENA-2K7' },
    nico: { phone: '+41791112233', name: 'Nico P.', age: 24, city: 'Zürich, Kreis 5', avatar: 'avatar-nico.jpg', joined: 9, org: 2, rate: 100, ref: 'NICO-8842' },
    jana: { phone: '+41794445566', name: 'Jana B.', age: 22, city: 'Zürich, Kreis 5', avatar: 'avatar-jana.jpg', joined: 12, org: 3, rate: 100, ref: 'JANA-3110' },
    tim: { phone: '+41797778899', name: 'Tim R.', age: 25, city: 'Zürich, Kreis 4', avatar: 'avatar-tim.jpg', joined: 8, org: 1, rate: 92, ref: 'TIM-5577' },
    mia: { phone: '+41793332211', name: 'Mia K.', age: 21, city: 'Zürich, Kreis 8', avatar: 'avatar-mia.jpg', joined: 7, org: 1, rate: 100, ref: 'MIA-9012' },
    noa: { phone: '+41796665544', name: 'Noa S.', age: 23, city: 'Zürich, Kreis 6', avatar: 'avatar-noa.jpg', joined: 11, org: 3, rate: 95, ref: 'NOA-1204' }
  };
  for (const u of Object.values(U)) {
    u.id = uid();
    insertUser.run(u.id, u.phone, u.name, u.age, u.city, u.avatar, verifiedAt, u.joined, u.org, u.rate, u.ref, joinedAt);
  }

  const A = {};
  const act = (key, o) => {
    A[key] = { id: uid(), ...o };
    insertActivity.run(A[key].id, o.by.id, o.category, o.title, o.description, o.startTime, o.endTime,
      o.areaLabel, o.locationName, o.address, o.locationHint || '', o.lat, o.lng, o.photo || null,
      o.maxPeople, o.verifiedOnly === false ? 0 : 1, o.costTotal || 0, o.costNote || '', minsAgo(o.createdMinsAgo || 600));
  };
  const join = (key, user, mins, paid = 0) => insertMember.run(uid(), A[key].id, user.id, minsAgo(mins), paid);
  const sys = (key, text, mins) => insertMessage.run(uid(), A[key].id, null, 'system', text, minsAgo(mins));
  const say = (key, user, text, mins) => insertMessage.run(uid(), A[key].id, user.id, 'msg', text, minsAgo(mins));

  // --- 01 The confirmed meetup: Lena is in, countdown is running. -----------
  act('volley', {
    by: U.jana, category: 'Sport',
    title: 'Feierabend-Volleyball',
    description: 'Zwei Netze sind reserviert. Kein Können nötig – wir spielen locker bis es dunkel wird und gehen danach vielleicht noch an den Kiosk.',
    startTime: inHours(2.23), endTime: inHours(3.73),
    areaLabel: 'Josefwiese, Kreis 5',
    locationName: 'Josefwiese, Eingang Josefstrasse',
    address: 'Josefstrasse 84, 8005 Zürich',
    locationHint: 'Beim Kiosk · Tram 4 bis Escher-Wyss-Platz',
    lat: 47.38732, lng: 8.52539, photo: 'sport.jpg',
    maxPeople: 6, costTotal: 30, costNote: 'Platzmiete Josefwiese', createdMinsAgo: 1400
  });
  join('volley', U.jana, 1400, 1); join('volley', U.mia, 900, 1); join('volley', U.nico, 620, 1);
  join('volley', U.lena, 320); join('volley', U.tim, 12);
  sys('volley', 'Jana B. hat die Aktivität erstellt', 1400);
  sys('volley', 'Mia K. ist beigetreten · verifiziert', 900);
  say('volley', U.jana, 'Ich bringe zwei Bälle mit. Netz ist reserviert bis 20:00.', 890);
  sys('volley', 'Nico P. ist beigetreten · verifiziert', 620);
  say('volley', U.mia, 'Perfekt, ich bin 5 Minuten früher da.', 600);
  sys('volley', 'Lena M. ist beigetreten · verifiziert', 320);
  say('volley', U.lena, 'Bin dabei. Kommt ihr mit dem 4er?', 310);
  say('volley', U.jana, 'Ja, 18:12 ab Escher-Wyss-Platz. Wir warten beim Kiosk.', 296);
  sys('volley', 'Tim R. ist beigetreten · verifiziert', 12);

  // --- 02 The join demo: Lena is NOT in this one yet. -----------------------
  act('bootcamp', {
    by: U.nico, category: 'Sport',
    title: 'Sunset Bootcamp am Letten',
    description: 'Lockeres Outdoor-Workout direkt an der Limmat. 45 Minuten Zirkeltraining, danach wer mag noch ein Bad oder ein Rivella am Fluss. Alle Levels willkommen – bring eine Matte und gute Laune mit.',
    // 19:45 keeps it clear of the floating confirmed meetup (~now + 2 h 15).
    startTime: soon(19, 45), endTime: soon(21, 0),
    areaLabel: 'Oberer Letten, Kreis 5',
    locationName: 'Letten Flusswiese, beim Steg',
    address: 'Wasserwerkstrasse 141, 8037 Zürich',
    locationHint: 'Beim oberen Steg · Tram 4 bis Limmatplatz',
    lat: 47.38607, lng: 8.53398, photo: 'park.jpg',
    maxPeople: 6, costTotal: 0, createdMinsAgo: 700
  });
  join('bootcamp', U.nico, 700); join('bootcamp', U.mia, 240); join('bootcamp', U.jana, 120); join('bootcamp', U.tim, 30);
  sys('bootcamp', 'Nico P. hat die Aktivität erstellt', 700);
  sys('bootcamp', 'Mia K. ist beigetreten · verifiziert', 240);
  say('bootcamp', U.nico, 'Hey zäme! Freut mich, dass ihr dabei seid 🙌', 230);
  sys('bootcamp', 'Jana B. ist beigetreten · verifiziert', 120);
  say('bootcamp', U.mia, 'Ich bringe eine zweite Matte mit, falls jemand eine braucht.', 118);
  sys('bootcamp', 'Tim R. ist beigetreten · verifiziert', 30);

  // --- 03..09 The rest of the board ----------------------------------------
  act('lernen', {
    by: U.tim, category: 'Lernen',
    title: 'Lernsession Statistik',
    description: 'Gemeinsam fokussiert lernen in der ETH-Bibliothek. 2 × 50 Minuten Fokus, dazwischen Kaffeepause. Fach egal – Hauptsache produktiv.',
    startTime: soon(14, 0), endTime: soon(17, 0),
    areaLabel: 'ETH Hönggerberg, Kreis 10',
    locationName: 'ETH Hönggerberg, Bibliothek HIL',
    address: 'Stefano-Franscini-Platz 5, 8093 Zürich',
    locationHint: 'Erdgeschoss, hinterer Lesesaal',
    lat: 47.40828, lng: 8.50745,
    maxPeople: 4, costTotal: 0, createdMinsAgo: 800
  });
  join('lernen', U.tim, 800); join('lernen', U.noa, 200);
  sys('lernen', 'Tim R. hat die Aktivität erstellt', 800);
  sys('lernen', 'Noa S. ist beigetreten · verifiziert', 200);

  act('kino', {
    by: U.mia, category: 'Kino',
    title: 'Dune: Teil Drei',
    description: 'Wir schauen Dune 3 im Riffraff. Tickets hole ich online, bitte euren Anteil hier senden. Nachher noch kurz was trinken an der Neugasse.',
    startTime: soon(20, 15), endTime: soon(22, 50),
    areaLabel: 'Kino Riffraff, Kreis 5',
    locationName: 'Kino Riffraff, Saal 2',
    address: 'Neugasse 57, 8005 Zürich',
    locationHint: 'Reihe 5 · Treffpunkt an der Bar',
    lat: 47.38384, lng: 8.53052,
    maxPeople: 5, costTotal: 60, costNote: 'Ticket + Popcorn', createdMinsAgo: 500
  });
  join('kino', U.mia, 500, 1); join('kino', U.tim, 380, 1); join('kino', U.noa, 260); join('kino', U.jana, 90);
  sys('kino', 'Mia K. hat die Aktivität erstellt', 500);
  say('kino', U.mia, 'Ich hole die Tickets online, Saal 2 Reihe 5 🍿', 495);
  sys('kino', 'Tim R. ist beigetreten · verifiziert', 380);
  sys('kino', 'Noa S. ist beigetreten · verifiziert', 260);
  sys('kino', 'Jana B. ist beigetreten · verifiziert', 90);

  act('ramen', {
    by: U.noa, category: 'Essen',
    title: 'Ramen in Wiedikon',
    description: 'Kleiner Laden, grosse Schüsseln. Jeder zahlt selbst, wir sichern nur den Tisch für sechs.',
    startTime: soon(19, 0), endTime: soon(20, 30),
    areaLabel: 'Bederstrasse, Kreis 2',
    locationName: 'Ramen Bar Bederstrasse',
    address: 'Bederstrasse 55, 8002 Zürich',
    locationHint: 'Tisch auf den Namen Noa',
    lat: 47.36672, lng: 8.52544, photo: 'spritz.jpg',
    maxPeople: 6, costTotal: 0, createdMinsAgo: 420
  });
  join('ramen', U.noa, 420); join('ramen', U.mia, 150);
  sys('ramen', 'Noa S. hat die Aktivität erstellt', 420);

  act('gaming', {
    by: U.tim, category: 'Gaming',
    title: 'Mario Kart Turnier',
    description: 'Switch + Beamer sind da. Kleines Turnier mit sechs Leuten, Verlierer holt die nächste Runde Snacks. Kosten teilen wir.',
    startTime: at(1, 19, 30), endTime: at(1, 23, 0),
    areaLabel: 'Langstrasse, Kreis 4',
    locationName: 'WG Wohnzimmer, 3. Stock',
    address: 'Langstrasse 90, 8004 Zürich',
    locationHint: 'Klingel «Rüegg» · 3. Stock links',
    lat: 47.37852, lng: 8.52664, photo: 'garden.jpg',
    maxPeople: 6, costTotal: 30, costNote: 'Snacks & Getränke', createdMinsAgo: 760
  });
  join('gaming', U.tim, 760); join('gaming', U.nico, 400); join('gaming', U.noa, 100);
  sys('gaming', 'Tim R. hat die Aktivität erstellt', 760);
  sys('gaming', 'Nico P. ist beigetreten · verifiziert', 400);
  say('gaming', U.tim, 'Wer spielt Rainbow Road auf 200cc? 🎮', 350);

  act('uetliberg', {
    by: U.noa, category: 'Outdoor',
    title: 'Uetliberg Sunrise Walk',
    description: 'Früh hoch auf den Uetliberg, Sonnenaufgang am Aussichtspunkt, danach Kaffee beim Kiosk. Gemächliches Tempo, ca. 1.5 Stunden.',
    startTime: at(2, 6, 30), endTime: at(2, 9, 30),
    areaLabel: 'Hauptbahnhof, Kreis 1',
    locationName: 'HB SZU, Gleis 22',
    address: 'Bahnhofplatz, 8001 Zürich',
    locationHint: 'Vorderster Wagen · wir fahren 06:32',
    lat: 47.37718, lng: 8.53695, photo: 'rooftop.jpg',
    maxPeople: 5, costTotal: 0, createdMinsAgo: 900
  });
  join('uetliberg', U.noa, 900); join('uetliberg', U.mia, 500);
  sys('uetliberg', 'Noa S. hat die Aktivität erstellt', 900);

  act('pasta', {
    by: U.jana, category: 'Essen',
    title: 'Pasta Night & Wein',
    description: 'Wir kochen zusammen frische Pasta – jeder bringt eine Zutat mit, den Rest teilen wir. Danach Tischspiele.',
    startTime: at(3, 19, 0), endTime: at(3, 23, 0),
    areaLabel: 'Wiedikon, Kreis 3',
    locationName: 'Gemeinschaftsküche IDA-Areal',
    address: 'Baderstrasse 30, 8004 Zürich',
    locationHint: 'Hintereingang Hof · 1. Stock',
    lat: 47.37391, lng: 8.52621,
    maxPeople: 4, costTotal: 40, costNote: 'Zutaten & Wein', createdMinsAgo: 950
  });
  // Deliberately full: the board needs an "Ausgebucht" card too.
  join('pasta', U.jana, 950); join('pasta', U.noa, 240); join('pasta', U.mia, 180); join('pasta', U.tim, 60);
  sys('pasta', 'Jana B. hat die Aktivität erstellt', 950);
  sys('pasta', 'Noa S. ist beigetreten · verifiziert', 240);
  say('pasta', U.jana, 'Ich bringe Mehl und Eier mit – bringt ihr Sauce und Wein?', 230);
  sys('pasta', 'Mia K. ist beigetreten · verifiziert', 180);
  sys('pasta', 'Tim R. ist beigetreten · verifiziert', 60);

  act('boulder', {
    by: U.noa, category: 'Sport',
    title: 'Bouldern im Minimum',
    description: 'Zwei Stunden bouldern, danach Dusche und ein Bier. Leihschuhe gibt es vor Ort. Ideal auch für Einsteiger.',
    startTime: at(1, 17, 0), endTime: at(1, 19, 30),
    areaLabel: 'Hardbrücke, Kreis 5',
    locationName: 'Minimum Boulder, Eingang',
    address: 'Hardstrasse 219, 8005 Zürich',
    locationHint: 'Beim Empfang · Schuhe schon geholt',
    lat: 47.38927, lng: 8.51846, photo: 'bridge.jpg',
    maxPeople: 4, costTotal: 96, costNote: 'Eintritt + Leihschuhe', createdMinsAgo: 340
  });
  join('boulder', U.noa, 340); join('boulder', U.tim, 60);
  sys('boulder', 'Noa S. hat die Aktivität erstellt', 340);

  act('filmnacht', {
    by: U.nico, category: 'Kino',
    title: 'Kurzfilmnacht im Xenix',
    description: 'Vier Kurzfilme, danach ein Bier im Hof.',
    startTime: at(-2, 20, 0), endTime: at(-2, 22, 30),
    areaLabel: 'Kanzleiareal, Kreis 4',
    locationName: 'Kino Xenix',
    address: 'Kanzleistrasse 52, 8004 Zürich',
    locationHint: 'Treffpunkt im Hof',
    lat: 47.37489, lng: 8.52548,
    maxPeople: 5, costTotal: 55, costNote: 'Tickets', createdMinsAgo: 5000
  });
  join('filmnacht', U.nico, 5000, 1); join('filmnacht', U.tim, 4800, 1); join('filmnacht', U.mia, 4600, 1);
  sys('filmnacht', 'Nico P. hat die Aktivität erstellt', 5000);
  insertRating.run(uid(), A.filmnacht.id, U.tim.id, 4, JSON.stringify(['Entspannt']), 1, minsAgo(2800));

  // --- 10 Yesterday's meetup: waiting for Lena's rating. --------------------
  act('brunch', {
    by: U.jana, category: 'Essen',
    title: 'Brunch im Kreis 4',
    description: 'Sonntagsbrunch mit allem was dazugehört.',
    startTime: at(-1, 11, 0), endTime: at(-1, 13, 30),
    areaLabel: 'Helvetiaplatz, Kreis 4',
    locationName: 'Café Lang',
    address: 'Langstrasse 23, 8004 Zürich',
    locationHint: 'Tisch draussen',
    lat: 47.37922, lng: 8.52901, photo: 'spritz.jpg',
    maxPeople: 4, costTotal: 96, costNote: 'Brunch-Menu', createdMinsAgo: 4000
  });
  join('brunch', U.jana, 4000, 1); join('brunch', U.lena, 3900, 1); join('brunch', U.noa, 3800, 1);
  sys('brunch', 'Jana B. hat die Aktivität erstellt', 4000);
  say('brunch', U.jana, 'War super gestern – bis zum nächsten Mal! ☀️', 1300);
  insertRating.run(uid(), A.brunch.id, U.noa.id, 5, JSON.stringify(['Pünktlich', 'Gute Orga']), 1, minsAgo(1200));

  // Referral state for Lena: 1 verified, 1 pending -> progress 1 of 3.
  insertReferral.run(uid(), U.lena.id, U.mia.id, U.mia.name, U.mia.avatar, U.lena.ref, 'verified', at(-4, 12, 0));
  insertReferral.run(uid(), U.lena.id, null, 'Tim R.', null, U.lena.ref, 'pending', at(-1, 9, 0));

  console.log('[db] seeded demo data');
}

seedIfEmpty();
