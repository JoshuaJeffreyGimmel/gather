import type { Activity, ChatRow, Category, Me, Meetups, Message, NewActivity, PublicUser, Referrals } from './types';

const TOKEN_KEY = 'gather.token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode — the session just won't survive a reload */ }
}

/** An error carrying the machine-readable code the API returned. */
export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
  /** German copy for the codes the UI can actually run into. */
  get german(): string {
    switch (this.code) {
      case 'verification_required': return 'Dafür musst du verifiziert sein.';
      case 'activity_full': return 'Diese Aktivität ist leider schon voll.';
      case 'already_joined': return 'Du bist schon dabei.';
      case 'already_over': return 'Diese Aktivität ist schon vorbei.';
      case 'not_joined': return 'Du bist hier nicht dabei.';
      case 'organizer_cannot_leave': return 'Als Organisator:in kannst du nicht absagen.';
      case 'join_required': return 'Nur Zugesagte können das sehen.';
      case 'already_paid': return 'Dein Anteil ist schon gesendet.';
      case 'nothing_to_pay': return 'Hier gibt es nichts zu teilen.';
      case 'not_over_yet': return 'Bewerten kannst du erst nach dem Treffen.';
      case 'invalid_code': return 'Bitte gib sechs Ziffern ein.';
      case 'invalid_phone': return 'Diese Nummer sieht nicht richtig aus.';
      case 'own_code': return 'Das ist dein eigener Code.';
      case 'unknown_code': return 'Diesen Code kennen wir nicht.';
      case 'already_redeemed': return 'Du hast schon einen Code eingelöst.';
      case 'title_required': return 'Gib deiner Aktivität einen Namen.';
      case 'invalid_location': return 'Wähle einen Treffpunkt.';
      case 'unauthorized': return 'Bitte melde dich neu an.';
      case 'offline': return 'Keine Verbindung zum Server.';
      default: return 'Das hat gerade nicht geklappt.';
    }
  }
}

type Method = 'GET' | 'POST';

async function call<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError(0, 'offline');
  }

  if (res.status === 204) return undefined as T;

  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON body */ }

  if (!res.ok) {
    // A dead token should drop us back to the door rather than loop.
    if (res.status === 401 && token) setToken(null);
    throw new ApiError(res.status, json?.error || 'server_error');
  }
  return json as T;
}

export const api = {
  requestCode: (phone: string) =>
    call<{ ok: true; phone: string; devCode: string }>('POST', '/auth/request-code', { phone }),

  verifyCode: (phone: string, code: string, name?: string) =>
    call<{ token: string; isNew: boolean; user: Me }>('POST', '/auth/verify-code', { phone, code, name }),

  verifyId: () => call<{ user: Me }>('POST', '/me/verify-id'),

  me: () => call<{ user: Me }>('GET', '/me'),

  updateMe: (patch: { name?: string; age?: number; city?: string }) =>
    call<{ user: Me }>('POST', '/me', patch),

  logout: () => call<{ ok: true }>('POST', '/auth/logout'),

  activities: (category?: Category | 'Alle') =>
    call<{ activities: Activity[]; categories: Category[]; total: number }>(
      'GET',
      '/activities' + (category && category !== 'Alle' ? `?category=${encodeURIComponent(category)}` : '')
    ),

  activity: (id: string) => call<{ activity: Activity }>('GET', `/activities/${id}`),

  create: (draft: NewActivity) => call<{ activity: Activity }>('POST', '/activities', draft),

  join: (id: string) => call<{ activity: Activity }>('POST', `/activities/${id}/join`),

  leave: (id: string) => call<{ activity: Activity }>('POST', `/activities/${id}/leave`),

  messages: (id: string, since?: string) =>
    call<{ messages: Message[] }>('GET', `/activities/${id}/messages` + (since ? `?since=${encodeURIComponent(since)}` : '')),

  send: (id: string, text: string) => call<{ message: Message }>('POST', `/activities/${id}/messages`, { text }),

  rate: (id: string, stars: number, tags: string[], allShowedUp: boolean) =>
    call<{ activity: Activity }>('POST', `/activities/${id}/rate`, { stars, tags, allShowedUp }),

  pay: (id: string) => call<{ activity: Activity; paid: number }>('POST', `/activities/${id}/pay`),

  meetups: () => call<Meetups>('GET', '/me/meetups'),

  chats: () => call<{ chats: ChatRow[] }>('GET', '/me/chats'),

  referrals: () => call<Referrals>('GET', '/me/referrals'),

  redeem: (code: string) =>
    call<{ ok: true; inviter: PublicUser; status: string }>('POST', '/referrals/redeem', { code })
};
