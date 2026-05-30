import { GameShell } from "./GameShell";
import { BombParty } from "./BombParty";
import { PetitBac } from "./PetitBac";
import { SixQuiPrend } from "./SixQuiPrend";
import { Codenames } from "./Codenames";
import { gameById, type RoomState } from "@shared";

/** Renders the active game for a room whose phase is "playing". */
export function GamePlay({ room, onLeave }: { room: RoomState; onLeave: () => void }) {
  const meta = gameById(room.selectedGame);
  const title = `${meta.emoji} ${meta.name}`;

  return (
    <GameShell title={title} onLeave={onLeave}>
      {room.game?.kind === "bombparty" && <BombParty room={room} />}
      {room.game?.kind === "petitbac" && <PetitBac room={room} />}
      {room.game?.kind === "sixquiprend" && <SixQuiPrend room={room} />}
      {room.game?.kind === "codenames" && <Codenames room={room} />}
      {!room.game && (
        <div className="grid flex-1 place-items-center text-mist">Loading game…</div>
      )}
    </GameShell>
  );
}
