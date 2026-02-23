import { useEffect, useRef, useCallback } from 'react';
import { API_BASE } from './constants';
import { getToken } from './api';

type WSMessage = {
  type: string;
  [key: string]: any;
};

type WSCallback = (msg: WSMessage) => void;

let globalWs: WebSocket | null = null;
let listeners: Set<WSCallback> = new Set();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const getWsUrl = () => {
  const base = API_BASE.replace('/api', '').replace('https://', 'wss://').replace('http://', 'ws://');
  return `${base}/api/ws`;
};

async function connectWebSocket() {
  const token = await getToken();
  if (!token || globalWs?.readyState === WebSocket.OPEN) return;

  try {
    const wsUrl = `${getWsUrl()}/${token}`;
    globalWs = new WebSocket(wsUrl);

    globalWs.onopen = () => {
      console.log('[WS] Connected');
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };

    globalWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        listeners.forEach(cb => cb(data));
      } catch {}
    };

    globalWs.onclose = () => {
      console.log('[WS] Disconnected, reconnecting...');
      globalWs = null;
      reconnectTimer = setTimeout(connectWebSocket, 3000);
    };

    globalWs.onerror = () => {
      globalWs?.close();
    };

    // Keepalive ping
    const pingInterval = setInterval(() => {
      if (globalWs?.readyState === WebSocket.OPEN) {
        globalWs.send(JSON.stringify({ type: 'ping' }));
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
  } catch {
    reconnectTimer = setTimeout(connectWebSocket, 5000);
  }
}

export function disconnectWebSocket() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  globalWs?.close();
  globalWs = null;
  listeners.clear();
}

export function sendWsMessage(data: any) {
  if (globalWs?.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify(data));
  }
}

export function useWebSocket(onMessage?: WSCallback) {
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    connectWebSocket();

    const handler: WSCallback = (msg) => {
      callbackRef.current?.(msg);
    };

    if (onMessage) {
      listeners.add(handler);
    }

    return () => {
      listeners.delete(handler);
    };
  }, []);

  return { sendMessage: sendWsMessage };
}
