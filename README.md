# NutriAR
A responsive calorie and macro diary with 89 Argentine/everyday foods, camera-based meal estimates, goals, water, notes, activity calories and weight history. Inspired by the supplied Calo video and neon diary mockup.

## Deploy from GitHub to Vercel

1. Open [New Vercel project](https://vercel.com/new) in an account/team where you can create projects.
2. Import the existing private repository `asielhm/caltracker`. If it is missing, grant **Vercel's GitHub app** access to this repository. ChatGPT's GitHub access is a separate installation.
3. Keep Framework Preset **Other**, Root Directory **./** and Output Directory **dist**. The committed `vercel.json` supplies the build and function configuration. Use Node 22 or later.
4. Add these **Secret** environment variables for **Production** (and Preview if you want preview photo analysis):

   | Variable | Value |
   |---|---|
   | `GEMINI_API_KEY` | Your Google AI Studio API key |
   | `APP_PASSWORD` | A strong private password for your photo API |

   Optionally set `GEMINI_MODEL`; the default is `gemini-2.5-flash`. Never prefix the key with `NEXT_PUBLIC_` or `VITE_`.
5. Deploy. Vercel's Git integration deploys future pushes to `main` automatically. Pull requests/non-production branches get previews according to your Vercel settings.
6. On any device, open the deployed URL, open **Analyze**, and follow **Sign in** if prompted. Username: **nutriar**. Password: the `APP_PASSWORD` you configured. The Gemini key remains on the server and is shared across sessions; users do not enter or save it in the app.
7. After setting/changing environment variables, **redeploy** so the running functions receive them.

`api/config.js`, `api/analyze.js` and `api/auth.js` are Vercel Functions; `vercel-api.mjs` provides the password check and forwards requests to the shared Gemini API handler. The paid API fails closed until `APP_PASSWORD` is configured. The static interface contains no key and remains separate from API authentication. To restrict the entire interface too, enable Vercel Deployment Protection for the intended environments.

Photo uploads are resized in the browser; prepared images are capped at 3 MB to fit Vercel's request-body limit after base64 encoding. The API key is never included in a browser request or response, diary state or backups. Diarized foods still live in each browser; server-side AI credentials do not add cross-device diary sync.

### Current deployment access limitation

The connected Vercel account exposes the **FulFillOS** team. Project creation returned **403: permission denied**, and the Vercel Git connection did not list `caltracker`. No Vercel project was created. Import using an account/team you control, or grant that connection the required team/repository access before retrying. The code and tests are ready; no live Gemini key has been received or tested.

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
1. Open Analyze or Scan. Select **Take photo** to open the rear-camera preview, allow camera access, and select **Take this photo**. **Use phone camera instead** opens the native mobile capture picker; **Upload photo** opens the photo library. Closing the preview or dialog stops every camera track. Camera access requires HTTPS and browser permission. JPEG/PNG/WebP uploads up to 8 MB are resized before sending.
2. Optionally describe quantities, recipe details or cooking oil.
3. Click Analyze. The browser resizes to at most 1600 px and re-encodes as JPEG, then sends the photo and context to the same-origin `/api/analyze` endpoint.
4. The server calls Google Gemini's generateContent vision API with schema-constrained JSON output. It returns calorie and macro totals, confidence and portion assumptions. Non-food, invalid, refused and incomplete results are rejected.
5. Review/edit the name and nutrition, choose a meal and explicitly confirm before logging.

Photos are not persisted by NutriAR and are sent to Google Gemini only when Analyze is clicked. Provider handling is governed by the Google AI Studio project's data settings; NutriAR does not request persistent Gemini conversation state; provider retention and processing follow your Google AI Studio project terms. Only the confirmed nutrition estimate is saved in the browser diary. Photo estimates are approximate, particularly for hidden fats and ambiguous portions.

### Server configuration
Set `GEMINI_API_KEY` privately on the hosting provider. Never put it in client code, GitHub, `.openai/hosting.json`, or a committed `.env`. `GEMINI_MODEL` defaults to `gemini-2.5-flash`, a vision/structured-output capable model. The server reports readiness without exposing the key. Valid API access and billing are required. Configure project budgets/usage controls in the Google AI Studio account.

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

Gemini references: [image inputs](https://aistudio.google.com/docs/image-understanding), [structured outputs](https://aistudio.google.com/docs/structured-output) and [Interactions API](https://aistudio.google.com/docs/interactions-overview).

### Gemini compatibility and diagnostics
The backend uses `generateContent` with `gemini-2.5-flash` by default. A configured model returning 404 retries once on that default. Unsupported schema configuration retries once with a minimal request and explicit JSON instructions; the same server validation still applies. Google HTTP status is returned as `providerStatus` alongside a specific error code. Server logs contain only status/code, never the key, meal notes, photo, or raw upstream message.
