import { randomUUID } from "node:crypto";
import { validHealthImport, applyHealthImport } from "./health-data.mjs";
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
  redisFactory = (options) => new Redis(options),
  now = () => new Date().toISOString(),
}) {
  let client = redis;
  const redisUrl = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  const json = (status, value) =>
    Response.json(value, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  return async (request) => {
    const isStatus = new URL(request.url).pathname === "/api/storage-status";
    const isHealth = new URL(request.url).pathname === "/api/health";
    if (
      !(isHealth || isStatus ? ["POST"] : ["GET", "PUT"]).includes(
        request.method,
      )
    )
      return json(405, {
        error: isHealth || isStatus ? "Use POST." : "Use GET or PUT.",
      });
    if (
      (request.method === "PUT" || isStatus) &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return json(403, { error: "Same-origin requests required." });
    if (!client && (!redisUrl || !redisToken))
      return json(503, {
        error:
          "Connect Upstash Redis to this Vercel project to enable cloud saving.",
        code: "STORAGE_NOT_CONFIGURED",
      });
    try {
      client ??= redisFactory({
        url: redisUrl,
        token: redisToken,
        automaticDeserialization: false,
      });
      if (isStatus) {
        const probeKey = "nutriar:storage-check:" + randomUUID();
        const value = randomUUID();
        try {
          await client.set(probeKey, value, { ex: 60 });
          if ((await client.get(probeKey)) !== value)
            throw Error("Readback mismatch");
          const raw = await client.get("nutriar:diary:owner:v1");
          const document = raw ? JSON.parse(raw) : { revision: 0, state: null };
          if (document.state && !validState(document.state))
            return json(502, {
              ok: false,
              code: "DIARY_DATA_INVALID",
              error:
                "Database responds, but saved diary data needs review. Export your device backup before making changes.",
            });
          return json(200, {
            ok: true,
            read: true,
            write: true,
            revision: document.revision,
            days: Object.keys(document.state?.days || {}).length,
            updatedAt: document.updatedAt || null,
            checkedAt: now(),
          });
        } finally {
          try {
            await client.del(probeKey);
          } catch {}
        }
      }
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
        if (bytes > (isHealth ? 4096 : MAX_BYTES)) {
          await reader.cancel();
          return json(413, { error: "Diary exceeds 2 MB. Export a backup." });
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      let body;
      try {
        body = JSON.parse(text);
        if (isHealth) {
          if (!validHealthImport(body, new Date(now()))) throw Error();
        } else if (
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
      if (isHealth) {
        for (let attempt = 0; attempt < 4; attempt++) {
          const stored = await client.get(key);
          const current = stored
            ? JSON.parse(stored)
            : { revision: 0, state: null };
          const next = applyHealthImport(current, body, now());
          const encoded = JSON.stringify(next);
          if (Buffer.byteLength(encoded) > MAX_BYTES)
            return json(413, {
              error: "Diary storage limit reached. Export a backup.",
            });
          const saved = await client.eval(
            CAS,
            [key],
            [current.revision, encoded],
          );
          if (saved === encoded)
            return json(200, {
              ok: true,
              date: body.date,
              syncedAt: next.updatedAt,
            });
        }
        return json(409, {
          error: "Diary changed during import. Run the Shortcut again.",
        });
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
