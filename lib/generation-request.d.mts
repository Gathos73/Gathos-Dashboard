export function requestFingerprint(
  service: string,
  fields: unknown,
  keyId: string,
  files: Array<[string, { arrayBuffer(): Promise<ArrayBuffer> }]>,
): Promise<string>;

export function retainedIdentity(
  fingerprint: string,
  saved: { fingerprint?: string; key?: string } | null,
  create?: () => string,
): string;
