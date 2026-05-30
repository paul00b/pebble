import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared";

const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ??
  (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);

export type PebbleSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Single shared connection. Socket.IO handles reconnection automatically. */
export const socket: PebbleSocket = io(SERVER_URL, {
  autoConnect: true,
  transports: ["websocket"],
  reconnectionDelay: 400,
  reconnectionDelayMax: 4000,
});
