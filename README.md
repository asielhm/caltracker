# NutriAR
A responsive calorie and macro diary with 89 Argentine/everyday foods, camera-based meal estimates, goals, water, notes, activity calories and weight history. Inspired by the supplied Calo video and neon diary mockup.

## Run locally
Requires Node 22+. No package dependencies.
```
npm start
```
Open http://127.0.0.1:3000. To use a local untracked `.env`, copy `.env.example`, fill it privately and run `node --env-file=.env server.mjs`.

```
npm run check
npm test
npm run build:worker
```

## Photo analysis
1. Open Analyze or Scan, then take/upload a JPEG, PNG or WebP image up to 8 MB.
2. Optionally describe quantities, recipe details or cooking oil.
3. Click Analyze. The browser resizes to at most 1600 px and re-encodes as JPEG, then sends the photo and context to the same-origin `/api/analyze` endpoint.
4. The server calls OpenAI's Responses vision API with strict structured output and `store: false`. It returns calorie and macro totals, confidence and portion assumptions. Non-food, invalid, refused and incomplete results are rejected.
5. Review/edit the name and nutrition, choose a meal and explicitly confirm before logging.

Photos are not persisted by NutriAR and are sent to OpenAI only when Analyze is clicked. Provider handling is governed by the API project's OpenAI data settings; `store: false` is not a claim of zero provider retention. Only the confirmed nutrition estimate is saved in the browser diary. Photo estimates are approximate, particularly for hidden fats and ambiguous portions.

### Server configuration
Set `OPENAI_API_KEY` privately on the hosting provider. Never put it in client code, GitHub, `.openai/hosting.json`, or a committed `.env`. `OPENAI_MODEL` defaults to `gpt-4.1-mini`, a vision/structured-output capable model. The server reports readiness without exposing the key. Valid API access and billing are required. Configure project budgets/usage controls in the OpenAI account.

- **Live Sites app:** `scripts/build-worker.mjs` bundles all browser assets and the API into `dist/server/index.js`. Preserve the selected project ID in `.openai/hosting.json` and remove `static` when publishing the Worker. The Sites secret configuration supplies the key at runtime. Site authentication protects the app; paid analysis additionally requires the authenticated visitor header supplied by Sites. The current Site remains owner-private.
- **Node deployment:** deploy `server.mjs`, `api.mjs` and `dist/`. Set `HOST=0.0.0.0`, `APP_PASSWORD` and the host's `PORT`. Username: `nutriar`. Use HTTPS. If behind an HTTPS proxy, set `PUBLIC_ORIGIN` to the exact public HTTPS origin so origin checks match.
- **GitHub Pages/static hosting:** serves the diary but cannot execute the API. Use Node or the hosted Worker to enable photo analysis. The included Pages workflow is manual and does not change repository visibility.

The endpoint checks identity (Sites), origin, JSON size, image format/magic bytes and model output. One analysis at a time and 20 attempts/hour are enforced per actor **per process/Worker isolate**. These are best-effort controls, not durable global quotas; restarts and multiple isolates reset or distribute those limits. Use provider project controls for spending limits. Provider calls time out after 45 seconds; the UI supports retry and manual entry.

## Local diary and food data
Diary entries, goals and custom foods stay in browser storage. Export/import JSON backups to move between devices. There is no account-based cross-device diary sync.

37 generic starter foods use approximate nutrition per stated serving. 52 foods transcribed from the uploaded video preserve visible calorie values; the two opened detail screens also provide macros. Missing macros/unspecified weights are null, not zero. The diary marks partial macro totals. See [VIDEO-FOODS.md](VIDEO-FOODS.md) for the full transcription. Check package labels for precise nutrition.

## Interface
Dark-first obsidian design, layered calorie meter, unboxed macros, date capsules and floating dock. The theme toggle stores an optional light preference. Activity calories add to the daily energy budget; reduced motion is supported. See [DESIGN.md](DESIGN.md).

## API and verification
`api.mjs` is shared between Node and Worker, so request validation and provider behavior stay consistent. Tests cover provider request shape with a mocked response, credential failures, refusal/non-food handling, timeouts, quotas, image validation, built Worker asset/API routing and the existing diary calculations. A successful test suite does **not** verify a live provider key. Live photo estimation must be verified after the runtime key is configured.

OpenAI reference: [vision inputs](https://developers.openai.com/api/docs/guides/images-vision) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
