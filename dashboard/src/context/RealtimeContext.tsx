import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getToken } from "../lib/api";
import type { Activity, BotStatus, ChatMessage, LogEntry, SpotifyTrack } from "../lib/types";

const CHAT_LIMIT = 300;
const LOG_LIMIT = 400;
const ACTIVITY_LIMIT = 60;

interface RealtimeValue {
  connected: boolean;
  status: BotStatus | null;
  chat: ChatMessage[];
  activity: Activity[];
  logs: LogEntry[];
  track: SpotifyTrack | null;
}

const RealtimeContext = createContext<RealtimeValue | null>(null);

/**
 * Single WebSocket feeding every live surface of the dashboard.
 * It reconnects on its own with a backoff, so a bot restart heals the UI
 * without a page reload.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [track, setTrack] = useState<SpotifyTrack | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;

    const connect = () => {
      if (disposed) return;

      // No token when the bot runs with authentication disabled; the server
      // accepts the upgrade in that mode.
      const token = getToken();
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(
        `${protocol}://${window.location.host}/ws${query}`
      );
      socketRef.current = socket;

      socket.onopen = () => {
        attemptsRef.current = 0;
        setConnected(true);
      };

      socket.onmessage = (event) => {
        const frame = JSON.parse(event.data) as { type: string; payload: unknown };

        switch (frame.type) {
          case "snapshot": {
            const snapshot = frame.payload as {
              status: BotStatus;
              chat: ChatMessage[];
              activity: Activity[];
            };
            setStatus(snapshot.status);
            setChat(snapshot.chat);
            setActivity(snapshot.activity);
            setTrack(snapshot.status.spotify.track ?? null);
            break;
          }
          case "status":
            setStatus(frame.payload as BotStatus);
            break;
          case "chat":
            setChat((current) =>
              [...current, frame.payload as ChatMessage].slice(-CHAT_LIMIT)
            );
            break;
          case "activity":
            setActivity((current) =>
              [frame.payload as Activity, ...current].slice(0, ACTIVITY_LIMIT)
            );
            break;
          case "log":
            setLogs((current) =>
              [...current, frame.payload as LogEntry].slice(-LOG_LIMIT)
            );
            break;
          case "track":
            setTrack(frame.payload as SpotifyTrack | null);
            break;
        }
      };

      socket.onclose = () => {
        setConnected(false);
        socketRef.current = null;
        if (disposed) return;

        attemptsRef.current += 1;
        const delay = Math.min(1000 * 2 ** (attemptsRef.current - 1), 20000);
        timerRef.current = window.setTimeout(connect, delay);
      };

      socket.onerror = () => socket.close();
    };

    connect();

    return () => {
      disposed = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      socketRef.current?.close();
    };
  }, []);

  const value = useMemo(
    () => ({ connected, status, chat, activity, logs, track }),
    [connected, status, chat, activity, logs, track]
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error("useRealtime must be used inside RealtimeProvider");
  return context;
}
