# Gather

> **Note:** This MVP was built with AI assistance as a simple school project — not a
> production release. That said, the trust mechanics and API are real enough that the
> approach would hold up as an actual product with further investment.

**Finden · Planen · Treffen** — a working prototype of the Gather app: a mobile-first
PWA that turns "wir sollten mal" into a real meetup tonight, for 18–25 year olds in
Zurich. Ten screens, a real API, a real database, real maps.

The whole product rests on one idea: **verification is not a hurdle at the end of
signup, it is the promise on every screen.** Phone number plus ID, once. After that a
"yes" means something — and the app is built so that it visibly does.

---

## Run it

```bash
docker compose up --build
```

Then open **<http://localhost:8080>**.

Two containers: `backend` (Express + SQLite on an internal network) and `web`
(nginx serving the built bundle and proxying `/api` to the backend). The database
lives on the `gather-db` volume, so the demo survives a restart. To start over from
the seeded board:

```bash
docker compose down -v && docker compose up --build
```

### Demo login

| Field | Value |
| --- | --- |
| Number | `79 000 00 00` (country code `+41` is fixed in the UI) |
| Code | `123456` — or any six digits |

That lands on **Lena M.**, who already has a confirmed meetup counting down, a group
chat, a cost split waiting to be settled, a past brunch waiting to be rated, and an
invite code with one verified referral.

Any other number signs up a **new, unverified** member, which is the way to see the
ID-scan step and the verification gates (join and create are both blocked until the
scan completes).

There is no SMS gateway. `POST /api/auth/request-code` returns the code in its
response and prints it to the container log; the code screen offers it as a one-tap
shortcut.

---

## Running without Docker

Node **22.13+** or **23.4+** is required — that is where the built-in `node:sqlite`
module stopped needing `--experimental-sqlite`. Because the database is built in,
there are **no native dependencies** to compile. Built and tested on Node 24.21.

```bash
# terminal 1 — API on :4000
cd backend && npm install && npm start

# terminal 2 — app on :5173, proxying /api to :4000
cd frontend && npm install && npm run dev
```

---

## Layout

```
gather/
├── docker-compose.yml       backend + web, one command
├── nginx/nginx.conf         static bundle, /api proxy, SPA fallback, caching
├── backend/
│   ├── Dockerfile           node:24-alpine, non-root, healthcheck
│   └── src/
│       ├── db.js            schema + the seeded Zurich board
│       └── index.js         every endpoint
│   └── scripts/
│       ├── smoke.mjs        83 assertions over the whole product loop
│       └── smoke-run.sh     boots the API on a throwaway DB and runs them
└── frontend/
    ├── Dockerfile           vite build → nginx
    ├── public/              manifest, service worker, icons, photography
    └── src/
        ├── styles/global.css  the design system, tokens first
        ├── components/        Ui, ActivityCards, Map, TabBar
        └── screens/           the ten screens, in the order of the design board
```

---

## The trust mechanics, and where they live

These are the parts that make Gather different from a group chat. All of them are
enforced on the server — the UI reflects them, it does not implement them.

| Mechanic | Where |
| --- | --- |
| **The exact meeting point is hidden until you commit.** Non-members get the neighbourhood and a map pin snapped to a ~250 m grid; members get the address, the hint ("Beim Kiosk · Tram 4") and the precise pin. | `activityJson()` in `backend/src/index.js` |
| **Only verified people can join or create.** Unverified accounts get `403 verification_required`, and the join button says so rather than failing silently. | `POST /activities/:id/join`, `POST /activities` |
| **Capacity is real.** 3–6 people, clamped server-side; a full activity returns `409 activity_full` and the card reads *Ausgebucht*. | `POST /activities/:id/join` |
| **Joining and leaving are announced in the chat** as system messages — *"Nico P. ist beigetreten · verifiziert"*. | `systemMessage()` |
| **Only people who said yes can read or write the chat.** Leaving closes it again (`403 join_required`). | `GET/POST /activities/:id/messages` |
| **Ratings are anonymous and only after the fact.** We store who rated purely to stop double votes and never hand that back; rating a future meetup is `409 not_over_yet`. | `POST /activities/:id/rate` |
| **The referral reward only lands once the invitee is verified.** Pending invites show as *Ausstehend*. | `GET /me/referrals`, `POST /referrals/redeem` |
| **The verified tick never appears alone.** It always sits beside a name, an avatar or a sentence that says what was checked. | `Tick` / `SafetyNote` in `frontend/src/components/Ui.tsx` |

---

## API

Bearer token in `Authorization`, JSON in and out. Errors are
`{ "error": "<machine_code>" }`; the client maps each code to a German sentence in
`frontend/src/api.ts`.

| | Endpoint | Notes |
| --- | --- | --- |
| 1 | `POST /api/auth/request-code` | Normalises the number, returns `devCode` |
| 2 | `POST /api/auth/verify-code` | Any six digits; signs up an unknown number |
| 3 | `POST /api/me/verify-id` | The mocked ID scan; flips `verified` |
| 4 | `GET /api/me` · `POST /api/me` | Read and edit the profile |
| 5 | `GET /api/activities` | `?category=` · `?scope=all` includes past ones |
| 6 | `GET /api/activities/:id` | Location fields depend on membership |
| 7 | `POST /api/activities` | Verified only; organiser joins automatically |
| 8 | `POST /api/activities/:id/join` | Verification, capacity and timing gates |
| 9 | `POST /api/activities/:id/leave` | Organiser cannot; re-hides the address |
| 10 | `GET /api/activities/:id/messages` | `?since=` makes polling cheap |
| 11 | `POST /api/activities/:id/messages` | Members only |
| 12 | `POST /api/activities/:id/rate` | 1–5 stars, tags, "alle erschienen" |
| 13 | `POST /api/activities/:id/pay` | The cost-split mock — no PSP |
| 14 | `GET /api/me/referrals` · `POST /api/referrals/redeem` | The invite programme |
| + | `GET /api/me/meetups` | `upcoming`, `past`, `next`, `toRate` |
| + | `GET /api/me/chats` | The chat list |
| + | `GET /api/health` | Used by the container healthcheck |

---

## Tests

```bash
cd backend && sh scripts/smoke-run.sh
```

Boots the API on a throwaway database, runs **83 assertions** across the full loop —
anonymous browsing, phone login, ID verification, the address reveal on join, the
capacity and verification gates, chat polling, the cost split, rating, creating,
leaving, referrals, a fresh signup and logout — then shuts everything down. It exits
non-zero on the first failure.

```bash
cd frontend && npm run typecheck   # tsc --noEmit, strict
cd frontend && npm run build       # typecheck + production bundle
```

---

## Decisions worth knowing about

- **Maps are real.** Leaflet on OpenStreetMap tiles, bundled from npm rather than a
  CDN. Every activity carries genuine Zurich coordinates. Tiles need network access
  at view time; without it the map area stays empty and nothing else breaks.
- **Chat polls every three seconds** rather than using websockets. For groups of six
  that is the right amount of machinery. `?since=` keeps each poll to the new
  messages only, and polling pauses when the tab is hidden.
- **"The chat closes 24 h after the meetup" is UI copy, not enforced.** Archived
  chats stay readable.
- **Photography** comes from the design board, re-encoded from PNG to progressive
  JPEG (3.1 MB → 314 KB) and cropped once into square avatars, so no `object-position`
  guesswork is needed at runtime.
- **Seed times are relative to first boot.** The confirmed meetup always starts about
  2 h 15 m out (rounded to five minutes, so it reads 18:45 and not 18:43), which keeps
  the countdown, the "Heute" labels and the reminder screen alive whenever you run it.
- **The reminder lock screen** is reached from the bell in the Discover header — a
  push notification is not something a web prototype can stage honestly.
- **`Organisator:in`** rather than a guessed gendered form; the app never infers
  gender from a name.

### Verified how

Docker is not available in the environment this was built in, so:

- The **backend** was run for real and the smoke suite passes (83/83).
- The **frontend** was driven end-to-end in headless Chromium at 390 × 844 — all ten
  screens, the join → reveal flow, sending a chat message, the payment mock and the
  rating sheet — against both the dev server and the **production bundle** served
  through a stand-in that mirrors the nginx routing (static files, `/api` proxy, SPA
  fallback, 404s for missing assets). Zero console errors, zero failed requests.
- The **Docker and nginx configuration** was reviewed statically: every `COPY` source
  checked to exist, lockfiles present for `npm ci`, compose service names matched to
  the nginx upstream, and the config checked for balanced blocks and terminated
  directives. It has not been executed.

---

## Ideas that did not make this cut

- Push notifications and a real SMS provider.
- Websockets for chat, and typing indicators.
- Actual payments — the split is settled with a single `sharePaid` flag.
- Editing or cancelling an activity as its organiser.
- A moderation queue behind "Etwas melden", which currently only acknowledges.
