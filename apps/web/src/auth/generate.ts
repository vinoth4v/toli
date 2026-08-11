import { randomBytes } from "node:crypto"

/**
 * Issued passwords — the kind Toli generates for somebody, rather than the
 * kind somebody chooses.
 *
 * Readable but not guessable: five groups of four from an alphabet with no
 * vowels and no lookalike characters, about 90 bits. A driver has to type
 * this on a phone once, reading it off the operator's screen, without
 * confusing O for 0 while doing it. The seed script uses the same shape for
 * the same reason; the alphabet lives here so the two cannot drift.
 */
const ALPHABET = "23456789bcdfghjkmnpqrstvwxz"

export function generatePassword(): string {
  const bytes = randomBytes(20)
  const characters = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length])
  return [0, 4, 8, 12, 16].map((start) => characters.slice(start, start + 4).join("")).join("-")
}
