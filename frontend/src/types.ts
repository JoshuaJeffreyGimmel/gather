export type Category = 'Sport' | 'Lernen' | 'Kino' | 'Gaming' | 'Essen' | 'Outdoor';

export interface UserStats {
  meetupsJoined: number;
  meetupsOrganized: number;
  showUpRate: number;
}

export interface PublicUser {
  id: string;
  name: string;
  age: number | null;
  city: string;
  avatar: string | null;
  verified: boolean;
  stats: UserStats;
}

export interface Me extends PublicUser {
  phone: string;
  verifiedAt: string | null;
  referralCode: string;
  createdAt: string;
}

export interface Participant extends PublicUser {
  joinedAt: string;
  sharePaid: boolean;
}

export interface Activity {
  id: string;
  category: Category;
  title: string;
  description: string;
  startTime: string;
  endTime: string | null;
  areaLabel: string;
  photo: string | null;
  locationRevealed: boolean;
  locationName: string | null;
  address: string | null;
  locationHint: string | null;
  lat: number;
  lng: number;
  maxPeople: number;
  verifiedOnly: boolean;
  costTotal: number;
  costPerPerson: number;
  costNote: string;
  createdAt: string;
  organizer: PublicUser;
  participants: Participant[];
  memberCount: number;
  spotsFree: number;
  paidCount: number;
  isJoined: boolean;
  isOrganizer: boolean;
  isPast: boolean;
  mySharePaid: boolean;
  myRating: { stars: number; tags: string[]; allShowedUp: boolean } | null;
  ratingCount: number;
  ratingAvg: number | null;
}

export interface Message {
  id: string;
  kind: 'msg' | 'system';
  text: string;
  createdAt: string;
  author: PublicUser | null;
}

export interface ChatRow {
  activity: Activity;
  lastMessage: Message | null;
  messageCount: number;
}

export interface Meetups {
  upcoming: Activity[];
  past: Activity[];
  next: Activity | null;
  toRate: Activity | null;
}

export interface Invite {
  id: string;
  name: string | null;
  avatar: string | null;
  status: 'pending' | 'verified';
  createdAt: string;
}

export interface Referrals {
  code: string;
  goal: number;
  verified: number;
  invites: Invite[];
}

export interface NewActivity {
  category: Category;
  title: string;
  description: string;
  startTime: string;
  endTime?: string;
  areaLabel: string;
  locationName: string;
  address: string;
  locationHint: string;
  lat: number;
  lng: number;
  photo: string | null;
  maxPeople: number;
  verifiedOnly: boolean;
  costTotal: number;
  costNote: string;
}
