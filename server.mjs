import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import { createDiaryHandler } from "./diary-api.mjs";
import { createApi } from "./api.mjs";
export { validEstimate } from "./api.mjs";
const root = fileURLToPath(new URL("./dist/", import.meta.url));
const allowed = new Map([
  ["/", "text/html"],
  ["/index.html", "text/html"],
  ["/app.js", "text/javascript"],
  ["/foods.js", "text/javascript"],
  ["/video-foods.js", "text/javascript"],
  ["/nutrition.js", "text/javascript"],
  ["/ui.js", "text/javascript"],
  ["/diary-data.js", "text/javascript"],
  ["/diary-sync.js", "text/javascript"],
  ["/camera.js", "text/javascript"],
  ["/assets/meal.jpg", "image/jpeg"],
  ["/style.css", "text/css"],
]);
export function createServer({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const api = createApi({ fetchImpl });
  const diary = createDiaryHandler({ env });
  return http.createServer(async (req, res) => {
    try {
      if (env.APP_PASSWORD) {
        const expected = Buffer.from(
          "Basic " +
            Buffer.from("nutriar:" + env.APP_PASSWORD).toString("base64"),
        );
        const actual = Buffer.from(req.headers.authorization || "");
        if (
          actual.length !== expected.length ||
          !timingSafeEqual(actual, expected)
        ) {
          res.writeHead(401, { "WWW-Authenticate": 'Basic realm="NutriAR"' });
          res.end(
            "Sign in with username nutriar and your configured password.",
          );
          return;
        }
      }
      const url = new URL(
        req.url,
        env.PUBLIC_ORIGIN || `http://${req.headers.host}`,
      );
      if (url.pathname.startsWith("/api/")) {
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers))
          if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
        headers.delete("oai-authenticated-user-id");
        headers.set(
          "x-nutriar-local-actor",
          req.socket.remoteAddress || "local",
        );
        const request = new Request(url, {
          method: req.method,
          headers,
          ...(["GET", "HEAD"].includes(req.method)
            ? {}
            : { body: Readable.toWeb(req), duplex: "half" }),
        });
        const response =
          url.pathname === "/api/diary"
            ? env.APP_PASSWORD
              ? await diary(request)
              : Response.json(
                  { error: "Configure APP_PASSWORD before cloud saving." },
                  { status: 503 },
                )
            : url.pathname === "/api/auth"
              ? new Response(null, { status: 303, headers: { Location: "/" } })
              : await api(request, env);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      if (!allowed.has(url.pathname)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const body = await readFile(
        join(root, url.pathname === "/" ? "index.html" : url.pathname.slice(1)),
      );
      res.writeHead(200, {
        "Content-Type": allowed.get(url.pathname),
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      if (!res.headersSent)
        res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unable to complete the request." }));
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (k) => {
    const i = process.argv.indexOf(k);
    return i < 0 ? undefined : process.argv[i + 1];
  };
  const port = Number(process.env.PORT || arg("--port") || 3000),
    host = process.env.HOST || arg("--host") || "127.0.0.1";
  if (host !== "127.0.0.1" && !process.env.APP_PASSWORD)
    throw Error("Set APP_PASSWORD before exposing the AI server to a network.");
  createServer().listen(port, host, () =>
    console.log(`NutriAR ready at http://${host}:${port}`),
  );
}
