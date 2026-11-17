import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
const signature = (value, password) =>
  createHmac("sha256", password)
    .update("nutriar-health-only:" + value)
    .digest("base64url");
export function issueHealthToken(password, now = Date.now()) {
  const expires = Math.floor(now / 1000) + 90 * 86400;
  const payload = `v1.${expires}.${randomBytes(18).toString("base64url")}`;
  return {
    token: payload + "." + signature(payload, password),
    expiresAt: new Date(expires * 1000).toISOString(),
  };
}
export function validHealthToken(token, password, now = Date.now()) {
  if (!password || typeof token !== "string" || token.length > 256)
    return false;
  const parts = token.split(".");
  if (
    parts.length !== 4 ||
    parts[0] !== "v1" ||
    !/^\d{10}$/.test(parts[1]) ||
    !/^[A-Za-z0-9_-]{24}$/.test(parts[2])
  )
    return false;
  if (
    Number(parts[1]) <= now / 1000 ||
    Number(parts[1]) > now / 1000 + 91 * 86400
  )
    return false;
  const expected = Buffer.from(
    signature(parts.slice(0, 3).join("."), password),
  );
  const actual = Buffer.from(parts[3]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
