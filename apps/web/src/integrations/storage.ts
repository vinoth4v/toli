import { createHash, createHmac } from "node:crypto"

/**
 * Object storage, signed by hand.
 *
 * The werft template scaffolds an S3 bucket and a bucket-scoped IAM user, so
 * the credentials have a documented home — but no AWS SDK is on the blessed
 * dependency list, and pulling one in to sign a single PUT would be a large
 * dependency for eighty lines of HMAC.
 *
 * So this is SigV4, written out. It is entirely pure and therefore tested,
 * which matters more here than usual: a signature that is subtly wrong fails
 * at upload time with an opaque 403, and the failure looks like a credentials
 * problem rather than a code one.
 *
 * A presigned PUT means the browser uploads straight to the bucket. The image
 * never travels through this app, which keeps a 4 MB photo off a serverless
 * function that bills by the millisecond.
 */

export type StorageConfig = {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

export function storageConfig(): StorageConfig | null {
  const bucket = process.env.S3_BUCKET?.trim()
  const region = process.env.AWS_REGION?.trim()
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim()

  if (!bucket || !region || !accessKeyId || !secretAccessKey) return null
  return { bucket, region, accessKeyId, secretAccessKey }
}

export function isStorageConfigured(): boolean {
  return storageConfig() !== null
}

const ALGORITHM = "AWS4-HMAC-SHA256"

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest()
}

/** Percent-encoding per RFC 3986, which is stricter than encodeURIComponent. */
export function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/**
 * The signing key: a chain of HMACs over date, region, service and the
 * terminator. Derived per day, which is why the credential scope carries a
 * date rather than a timestamp.
 */
export function signingKey(secret: string, date: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, "s3")
  return hmac(kService, "aws4_request")
}

export type PresignInput = {
  config: StorageConfig
  key: string
  /** Seconds the URL stays valid. Short: it is handed straight to a browser. */
  expiresIn?: number
  now?: Date
}

/**
 * A presigned PUT URL for an object.
 *
 * Query-string signing rather than an Authorization header, because the
 * browser doing the PUT cannot be asked to add headers it does not know about.
 */
export function presignPut(input: PresignInput): string {
  const { config, key } = input
  const expiresIn = input.expiresIn ?? 900
  const now = input.now ?? new Date()

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "")
  const date = amzDate.slice(0, 8)
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`
  const scope = `${date}/${config.region}/s3/aws4_request`

  const canonicalUri = `/${key.split("/").map(encodeRfc3986).join("/")}`
  const query = new Map<string, string>([
    ["X-Amz-Algorithm", ALGORITHM],
    ["X-Amz-Credential", `${config.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ])

  // Query parameters must be sorted by name, encoded, for the canonical form.
  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, value]) => `${encodeRfc3986(name)}=${encodeRfc3986(value)}`)
    .join("&")

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n")

  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n")
  const signature = hmac(
    signingKey(config.secretAccessKey, date, config.region),
    stringToSign,
  ).toString("hex")

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

/** Where the object will be readable from once uploaded. */
export function publicUrl(config: StorageConfig, key: string): string {
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key
    .split("/")
    .map(encodeRfc3986)
    .join("/")}`
}

/**
 * A storage key for a vehicle photo.
 *
 * Namespaced by vehicle so a bucket listing is browsable by a human, and
 * suffixed with a random component so re-uploading the same filename does not
 * silently replace last month's photograph of a different bus.
 */
export function photoKey(vehicleId: string, filename: string, random: string): string {
  const extension = filename.toLowerCase().match(/\.(jpe?g|png|webp|heic)$/)?.[0] ?? ".jpg"
  return `vehicles/${vehicleId}/${random}${extension}`
}

/** Same rules, different namespace: a person's face is not a vehicle's boot. */
export function avatarKey(userId: string, filename: string, random: string): string {
  const extension = filename.toLowerCase().match(/\.(jpe?g|png|webp|heic)$/)?.[0] ?? ".jpg"
  return `avatars/${userId}/${random}${extension}`
}
