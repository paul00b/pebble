import type { GameId } from "../../../shared/src/types.js";
import type { GameEngine } from "./engine.js";
import { bombParty } from "./bombparty.js";
import { petitBac } from "./petitbac.js";
import { sixQuiPrend } from "./sixquiprend.js";
import { codenames } from "./codenames.js";

export const ENGINES: Record<GameId, GameEngine<any>> = {
  bombparty: bombParty,
  petitbac: petitBac,
  sixquiprend: sixQuiPrend,
  codenames,
};
