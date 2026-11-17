import { Redis } from "@upstash/redis";
import { validState } from "./dist/diary-data.js";
const MAX_BYTES = 2 * 1024 * 1024;
const CAS = `
local raw = redis.call('GET', KEYS[1])
local rev = 0
if raw then rev = cjson.decode(raw).revision end
if rev ~= tonumber(ARGV[1]) then return raw or '{"revision":0,"state":null}' end
redis.call('SET', KEYS[1], ARGV[2])
return ARGV[2]
`;
export function createDiaryHandler({
  env,
  redis,
  now = () => new Date().toISOString(),
}) {
  let client = redis;
  const json = (status, value) =>
    Response.json(value, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  return async (request) => {
    if (!["GET", "PUT"].includes(request.method))
      return json(405, { error: "Use GET or PUT." });
    if (
      request.method === "PUT" &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return json(403, { error: "Same-origin requests required." });
    if (
      !client &&
      (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN)
    )
      return json(503, {
        error:
          "Connect Upstash Redis to this Vercel project to enable cloud saving.",
        code: "STORAGE_NOT_CONFIGURED",
      });
    try {
      client ??= new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
        automaticDeserialization: false,
      });
      // One private owner diary. No expiry: history survives deployments and sessions.
      const key = "nutriar:diary:owner:v1";
      if (request.method === "GET") {
        const raw = await client.get(key);
        return json(200, raw ? JSON.parse(raw) : { revision: 0, state: null });
      }
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return json(415, { error: "Send JSON." });
      let text = "";
      const reader = request.body?.getReader();
      if (!reader) return json(400, { error: "Missing diary." });
      let bytes = 0;
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) {
          await reader.cancel();
          return json(413, { error: "Diary exceeds 2 MB. Export a backup." });
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      let body;
      try {
        body = JSON.parse(text);
        if (
          !Number.isSafeInteger(body.revision) ||
          body.revision < 0 ||
          !validState(body.state)
        )
          throw Error();
        if (/"(?:__proto__|constructor|prototype)"\s*:/.test(text))
          throw Error();
      } catch {
        return json(400, { error: "Invalid diary data." });
      }
      const next = {
        revision: body.revision + 1,
        state: body.state,
        updatedAt: now(),
      };
      const raw = await client.eval(
        CAS,
        [key],
        [body.revision, JSON.stringify(next)],
      );
      const saved = JSON.parse(raw);
      // Matching revision alone is insufficient: a competing writer may own it.
      const accepted = raw === JSON.stringify(next);
      return json(accepted ? 200 : 409, saved);
    } catch {
      return json(502, {
        error:
          "Cloud saving is temporarily unavailable. Your device copy is retained.",
        code: "STORAGE_UNAVAILABLE",
      });
    }
  };
}
