import type { GameId } from "../../../shared/src/types.js";
import type { GameEngine } from "./engine.js";
import { bombParty } from "./bombparty.js";
import { petitBac } from "./petitbac.js";
import { sixQuiPrend } from "./sixquiprend.js";
import { codenames } from "./codenames.js";
import { skyjo } from "./skyjo.js";
import { gartic } from "./gartic.js";
import { devine9 } from "./devine9.js";
import { spyfall } from "./spyfall.js";
import { complots } from "./complots.js";
import { chateau } from "./chateau.js";
import { loveletter } from "./loveletter.js";

export const ENGINES: Record<GameId, GameEngine<any>> = {
  bombparty: bombParty,
  petitbac: petitBac,
  sixquiprend: sixQuiPrend,
  codenames,
  skyjo,
  gartic,
  devine9,
  spyfall,
  complots,
  chateau,
  loveletter,
};
