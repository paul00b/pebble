// Human-friendly room codes: short, uppercase, no ambiguous chars (no O/0/I/1),
// and screened against a small profanity blocklist so shared codes stay clean.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
const CODE_LENGTH = 4;

const BLOCKLIST = ["ANUS", "FUCK", "SHIT", "COCK", "CUNT", "TWAT"];

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Generate a code not already present in `taken` and not on the blocklist. */
export function generateRoomCode(taken: Set<string>): string {
  for (let attempts = 0; attempts < 100; attempts++) {
    const code = randomCode();
    if (!taken.has(code) && !BLOCKLIST.includes(code)) return code;
  }
  // Vanishingly unlikely fallback: extend length until unique.
  let code = randomCode() + randomCode();
  while (taken.has(code)) code = randomCode() + randomCode();
  return code;
}
