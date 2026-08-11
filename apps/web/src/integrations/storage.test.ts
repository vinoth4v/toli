import { describe, expect, it } from "vitest"
import { encodeRfc3986, photoKey, presignPut, publicUrl, signingKey } from "./storage.ts"

/**
 * A signature that is subtly wrong fails at upload with an opaque 403 that
 * looks like a credentials problem. These are the parts that can be checked
 * without a bucket.
 */

const config = {
  bucket: "toli-photos",
  region: "ap-south-1",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
}

const now = new Date("2026-08-11T10:00:00Z")

describe("presignPut", () => {
  it("signs a PUT that carries everything S3 needs to verify it", () => {
    const url = new URL(presignPut({ config, key: "vehicles/abc/xyz.jpg", now }))

    expect(url.host).toBe("toli-photos.s3.ap-south-1.amazonaws.com")
    expect(url.pathname).toBe("/vehicles/abc/xyz.jpg")
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256")
    expect(url.searchParams.get("X-Amz-Credential")).toContain(
      "20260811/ap-south-1/s3/aws4_request",
    )
    expect(url.searchParams.get("X-Amz-Date")).toBe("20260811T100000Z")
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host")
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/)
  })

  it("is deterministic for the same request, and different for any change", () => {
    const base = presignPut({ config, key: "vehicles/abc/one.jpg", now })

    expect(presignPut({ config, key: "vehicles/abc/one.jpg", now })).toBe(base)
    expect(presignPut({ config, key: "vehicles/abc/two.jpg", now })).not.toBe(base)
    expect(presignPut({ config, key: "vehicles/abc/one.jpg", now, expiresIn: 60 })).not.toBe(base)
    expect(
      presignPut({
        config: { ...config, region: "eu-central-1" },
        key: "vehicles/abc/one.jpg",
        now,
      }),
    ).not.toBe(base)
  })

  it("expires, and says so in the URL", () => {
    const url = new URL(presignPut({ config, key: "k.jpg", now, expiresIn: 300 }))
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300")
  })

  it("derives the signing key per day, not per request", () => {
    const morning = signingKey(config.secretAccessKey, "20260811", config.region)
    const evening = signingKey(config.secretAccessKey, "20260811", config.region)
    const tomorrow = signingKey(config.secretAccessKey, "20260812", config.region)

    expect(morning.equals(evening)).toBe(true)
    expect(morning.equals(tomorrow)).toBe(false)
  })
})

describe("encodeRfc3986", () => {
  it("escapes the characters encodeURIComponent leaves alone", () => {
    // S3 rejects a signature computed over a differently-escaped path.
    expect(encodeRfc3986("a!b'c(d)e*f")).toBe("a%21b%27c%28d%29e%2Af")
    expect(encodeRfc3986("plain-name_1.jpg")).toBe("plain-name_1.jpg")
  })
})

describe("photoKey", () => {
  it("namespaces by vehicle and keeps the extension", () => {
    expect(photoKey("veh-1", "front view.JPG", "r4nd0m")).toBe("vehicles/veh-1/r4nd0m.jpg")
    expect(photoKey("veh-1", "inside.png", "abc")).toBe("vehicles/veh-1/abc.png")
  })

  it("does not let an unknown extension through as-is", () => {
    // Re-uploading "photo.exe" should not produce an object nobody expected.
    expect(photoKey("veh-1", "photo.exe", "abc")).toBe("vehicles/veh-1/abc.jpg")
    expect(photoKey("veh-1", "noextension", "abc")).toBe("vehicles/veh-1/abc.jpg")
  })

  it("gives every upload its own key, so nothing silently overwrites", () => {
    expect(photoKey("veh-1", "front.jpg", "one")).not.toBe(photoKey("veh-1", "front.jpg", "two"))
  })
})

describe("publicUrl", () => {
  it("points at the object that was just signed for", () => {
    const key = "vehicles/abc/xyz.jpg"
    expect(publicUrl(config, key)).toBe(
      "https://toli-photos.s3.ap-south-1.amazonaws.com/vehicles/abc/xyz.jpg",
    )
    expect(new URL(presignPut({ config, key, now })).pathname).toBe(
      new URL(publicUrl(config, key)).pathname,
    )
  })
})
