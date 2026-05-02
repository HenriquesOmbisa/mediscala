import { useEffect, useRef } from "react";
import * as SecureStore from "expo-secure-store";

type WsHandler = (data: unknown) => void;

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export function useWebSocket(handlers: Record<string, WsHandler>) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let interval: ReturnType<typeof setInterval> | undefined;

    async function connect() {
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) return;

      const wsUrl = API_BASE.replace("http", "ws");
      ws = new WebSocket(`${wsUrl}/ws?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event && handlersRef.current[msg.event]) {
            handlersRef.current[msg.event](msg.data);
          }
        } catch {}
      };
    }

    connect();

    return () => {
      ws?.close();
      if (interval !== undefined) clearInterval(interval);
    };
  }, []);

  return wsRef;
}
