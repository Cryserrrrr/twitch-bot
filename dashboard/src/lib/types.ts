export type Role = "broadcaster" | "moderator";

export interface SessionUser {
  id: string;
  login: string;
  displayName: string;
  avatar?: string;
  role: Role;
}

export interface IntegrationState {
  enabled: boolean;
  connected: boolean;
  state?: string;
  streaming?: boolean;
  currentScene?: string | null;
  track?: SpotifyTrack | null;
  username?: string;
  platform?: string;
}

export interface BotStatus {
  startedAt: number;
  uptime: number;
  channel: string;
  prefix: string;
  language: string;
  live: boolean;
  chat: { connected: boolean; channel: string; identity: string | null };
  twitch: {
    state: "missing" | "ready" | "invalid";
    user: { id: string; login: string } | null;
    expiresAt: number;
    scopes: string[];
    missingScopes: string[];
    apiReady: boolean;
  };
  eventsub: { connected: boolean; subscriptions: string[] };
  spotify: IntegrationState;
  obs: IntegrationState;
  apex: IntegrationState;
}

export interface ChatMessage {
  id: string;
  username: string;
  displayName: string;
  color: string | null;
  badges: string[];
  message: string;
  time: number;
}

export interface Activity {
  kind: string;
  data: Record<string, unknown>;
  time: number;
}

export interface LogEntry {
  time: number;
  level: "debug" | "info" | "warn" | "error";
  scope: string;
  message: string;
}

export interface CustomCommand {
  id: number;
  name: string;
  content: string;
  created_by: string;
  created_at: string;
  usage_count: number;
  enabled: number;
  cooldown_seconds: number;
  permission: string;
}

export interface BuiltinCommand {
  name: string;
  aliases: string[];
  permission: string;
  cooldown: number;
  description: string;
  usage: string;
}

export interface BannedWord {
  id: number;
  word: string;
  action: "delete" | "timeout" | "ban";
  duration: number;
  added_by: string;
  added_at: string;
}

export interface AllowedLink {
  id: number;
  domain: string;
  added_by: string;
  added_at: string;
}

export interface RecurringMessage {
  id: number;
  name: string | null;
  message: string;
  interval_minutes: number;
  enabled: number;
  last_sent: string | null;
}

export interface Moderator {
  id: number;
  user_id: string;
  username: string;
  display_name: string;
  updated_at: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string;
  album: string;
  cover: string | null;
  url: string | null;
  duration: number;
  progress: number;
  isPlaying: boolean;
}

export interface EventRow {
  id: number;
  type: string;
  username: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface Overview {
  status: BotStatus;
  totals: Record<string, number>;
  series: Array<{
    day: string;
    message: number;
    follow: number;
    subscription: number;
    command: number;
    moderation: number;
  }>;
  topChatters: Array<{ username: string; count: number }>;
  recentEvents: EventRow[];
  channel: { title: string; game_name: string } | null;
  stream: { viewer_count: number; started_at: string; title: string } | null;
  followers: number | null;
}

export interface Settings {
  bannedWordsEnabled: boolean;
  allowedLinksEnabled: boolean;
  capsFilterEnabled: boolean;
  announceFollows: boolean;
  announceSubs: boolean;
  announceRaids: boolean;
  announceCheers: boolean;
  [key: string]: boolean | string;
}
