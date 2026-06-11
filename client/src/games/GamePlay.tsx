import { GameShell } from "./GameShell";
import { BombParty } from "./BombParty";
import { PetitBac } from "./PetitBac";
import { SixQuiPrend } from "./SixQuiPrend";
import { Codenames } from "./Codenames";
import { Skyjo } from "./Skyjo";
import { Gartic } from "./Gartic";
import { Devine9 } from "./Devine9";
import { Spyfall } from "./Spyfall";
import { Complots } from "./Complots";
import { Chateau } from "./Chateau";
import { LoveLetter } from "./LoveLetter";
import { useStore } from "@/lib/store";
import { gameById, type RoomState } from "@shared";

/** Renders the active game for a room whose phase is "playing". */
export function GamePlay({ room, onLeave }: { room: RoomState; onLeave: () => void }) {
  const meta = gameById(room.selectedGame);
  const title = `${meta.emoji} ${meta.name}`;
  const youId = useStore((s) => s.youId);
  const toLobby = useStore((s) => s.toLobby);
  const isHost = room.hostId === youId;

  return (
    <GameShell title={title} onLeave={onLeave} isHost={isHost} onEndGame={toLobby}>
      {room.game?.kind === "bombparty" && <BombParty room={room} />}
      {room.game?.kind === "petitbac" && <PetitBac room={room} />}
      {room.game?.kind === "sixquiprend" && <SixQuiPrend room={room} />}
      {room.game?.kind === "codenames" && <Codenames room={room} />}
      {room.game?.kind === "skyjo" && <Skyjo room={room} />}
      {room.game?.kind === "gartic" && <Gartic room={room} />}
      {room.game?.kind === "devine9" && <Devine9 room={room} />}
      {room.game?.kind === "spyfall" && <Spyfall room={room} />}
      {room.game?.kind === "complots" && <Complots room={room} />}
      {room.game?.kind === "chateau" && <Chateau room={room} />}
      {room.game?.kind === "loveletter" && <LoveLetter room={room} />}
      {!room.game && (
        <div className="grid flex-1 place-items-center text-mist">Loading game…</div>
      )}
    </GameShell>
  );
}
