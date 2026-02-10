import { nanoid } from 'nanoid'
import bcrypt from 'bcrypt'

const KEY_PREFIX = 'botworld_sk_'
const BCRYPT_SALT_ROUNDS = 12

/** Generate a new API key. Returns plaintext (show once) and bcrypt hash (store in DB). */
export async function generateApiKey(): Promise<{ plaintext: string; hash: string }> {
  const plaintext = `${KEY_PREFIX}${nanoid(32)}`
  const hash = await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS)
  return { plaintext, hash }
}

/** Hash a plaintext API key. */
export async function hashApiKey(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS)
}

/** Verify a plaintext API key against a stored bcrypt hash. */
export async function verifyApiKey(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash)
}

/** Fast check if a string looks like a valid botworld API key. */
export function isBotworldKey(key: string): boolean {
  return key.startsWith(KEY_PREFIX) && key.length === KEY_PREFIX.length + 32
}
