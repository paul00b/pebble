// Explicit re-exports (not `export *`) so Node's ESM loader can statically
// detect every named export when the server runs the TS sources via tsx.
export { GAMES, gameById } from "./types";
export type {
  GameId,
  RoomPhase,
  Player,
  GameMeta,
  ChatMessage,
  RoomState,
} from "./types";
export type {
  PlayerIdentity,
  CreateRoomPayload,
  JoinRoomPayload,
  JoinResult,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./protocol";
export type {
  Language,
  BombPartyView,
  BombPartyAction,
  PetitBacStage,
  PetitBacCell,
  PetitBacView,
  PetitBacAction,
  GameView,
  GameAction,
} from "./games";
