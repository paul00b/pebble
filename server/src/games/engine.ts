// The small contract every game implements. The room is game-agnostic: it
// instantiates an engine on start, feeds it validated actions + time ticks,
// and broadcasts whatever view() returns. Adding a game = implement this once.

import type { DrawOp, GameAction, GameView, Language } from "../../../shared/src/games.js";
import type { Player } from "../../../shared/src/types.js";

export interface ActionContext {
  now: number;
  /** Whether the acting player is currently the room host. */
  isHost: boolean;
}

export interface InitOptions {
  /** Game-content language chosen for the room. */
  language: Language;
}

export interface GameEngine<State = unknown> {
  /** Build the initial authoritative state from the lobby's players. */
  init(players: Player[], now: number, opts: InitOptions): State;
  /** Trim the authoritative state into the public, client-facing view. */
  view(state: State): GameView;
  /**
   * Optional per-player view for games with hidden information (e.g. hands).
   * When present, each player is sent their own tailored snapshot.
   */
  playerView?(state: State, playerId: string): GameView;
  /** Has the game finished? (the view still shows, with `over: true`) */
  isOver(state: State): boolean;
  /** Apply a player's move. Mutates state. Returns true if anything changed. */
  action(state: State, playerId: string, action: GameAction, ctx: ActionContext): boolean;
  /** Advance time-based state (timers). Mutates state. Returns true if changed. */
  tick(state: State, now: number): boolean;
  /** A player left mid-game. Mutates state. Returns true if changed. */
  onLeave(state: State, playerId: string, now: number): boolean;

  /** Optional real-time drawing side-channel (Gartic). */
  drawOps?(state: State): DrawOp[];
  /** Apply a drawing op; returns true if accepted (and should be relayed). */
  applyDrawOp?(state: State, playerId: string, op: DrawOp): boolean;
}
