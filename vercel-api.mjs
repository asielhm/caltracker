import { issueHealthToken, validHealthToken } from "./health-auth.mjs";
import { timingSafeEqual } from "node:crypto";
import { createDiaryHandler } from "./diary-api.mjs";
import { createApi } from "./api.mjs";
export function createVercelHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  redis,
} = {}) {
  const api = createApi({ fetchImpl });
  const diary = createDiaryHandler({ env, redis });
  return async function handleVercel(request, path) {
    // Fail closed until the owner configures a private app password.
    if (!env.APP_PASSWORD)
      return Response.json(
        {
          error:
            "Configure APP_PASSWORD in the Vercel environment before using photo analysis.",
          code: "AUTH_NOT_CONFIGURED",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    if (path === "/api/health") {
      const token = request.headers
        .get("authorization")
        ?.replace(/^Bearer /, "");
      if (
        !request.headers.get("authorization")?.startsWith("Bearer ") ||
        !validHealthToken(token, env.APP_PASSWORD)
      )
        return Response.json(
          {
            error:
              "The Apple Health connection token is invalid or expired. Create a new one using Connect Apple Health.",
          },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        );
      return diary(request);
    }
    const expected = Buffer.from(
      "Basic " + Buffer.from("nutriar:" + env.APP_PASSWORD).toString("base64"),
    );
    const actual = Buffer.from(request.headers.get("authorization") || "");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return Response.json(
        {
          error: "Sign in with username nutriar and your app password.",
          signInUrl: "/api/auth",
        },
        {
          status: 401,
          headers: {
            "WWW-Authenticate":
              'Basic realm="NutriAR photo analysis", charset="UTF-8"',
            "Cache-Control": "no-store",
          },
        },
      );
    if (path === "/api/health-token") {
      if (request.method !== "POST") return new Response(null, { status: 405 });
      if (request.headers.get("origin") !== new URL(request.url).origin)
        return new Response(null, { status: 403 });
      return Response.json(issueHealthToken(env.APP_PASSWORD), {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    if (path === "/api/diary" || path === "/api/storage-status")
      return diary(request);
    if (path === "/api/auth")
      return new Response(null, {
        status: 303,
        headers: { Location: "/", "Cache-Control": "no-store" },
      });
    const url = new URL(request.url);
    url.pathname = path;
    const headers = new Headers(request.headers);
    // Sites identity headers are not trusted on a different host.
    headers.delete("oai-authenticated-user-id");
    headers.delete("x-nutriar-local-actor");
    headers.set("x-nutriar-local-actor", "owner");
    return api(
      new Request(url, {
        method: request.method,
        headers,
        signal: request.signal,
        ...(["GET", "HEAD"].includes(request.method)
          ? {}
          : { body: request.body, duplex: "half" }),
      }),
      env,
    );
  };
}
export const handleVercel = createVercelHandler();
