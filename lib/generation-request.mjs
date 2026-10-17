/** @param {ArrayBuffer} value */
async function sha256(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", value)))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash actual file contents; filenames and sizes cannot identify a request.
 * @param {string} service
 * @param {unknown} fields
 * @param {string} keyId
 * @param {Array<[string, { arrayBuffer(): Promise<ArrayBuffer> }]>} files
 */
export async function requestFingerprint(service, fields, keyId, files) {
  const hashes = await Promise.all(files.map(async ([name, file]) => [name, await sha256(await file.arrayBuffer())]));
  return sha256(new TextEncoder().encode(JSON.stringify([service, fields, keyId, hashes])).buffer);
}

/**
 * @param {string} fingerprint
 * @param {{fingerprint?: string, key?: string} | null} saved
 * @param {() => string} create
 */
export function retainedIdentity(fingerprint, saved, create = () => crypto.randomUUID()) {
  return saved?.fingerprint === fingerprint && saved.key ? saved.key : create();
}
