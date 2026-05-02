import { useEffect, useRef } from "react";
import { useAuthStore } from "../store/auth.store";

type WsHandler = (data: unknown) => void;

export function useWebSocket(handlers: Record<string, WsHandler>) {
  const { accessToken } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!accessToken) return;

    let intentionalClose = false;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${protocol}://${window.location.host}/ws?token=${accessToken}`,
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event && handlersRef.current[msg.event]) {
          handlersRef.current[msg.event](msg.data);
        }
      } catch {}
    };

    ws.onerror = (e) => {
      if (!intentionalClose) console.error("WS error", e);
    };

    return () => {
      intentionalClose = true;
      // Avoid aborting mid-handshake when React Strict Mode remounts (noisy browser warning).
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CLOSING
      ) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener("open", () => ws.close(), { once: true });
      }
    };
  }, [accessToken]);

  return wsRef;
}
