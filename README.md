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

   Optionally set `GEMINI_MODEL`; the default is `gemini-flash-latest`. Never prefix the key with `NEXT_PUBLIC_` or `VITE_`.
5. Deploy. Vercel's Git integration deploys future pushes to `main` automatically. Pull requests/non-production branches get previews according to your Vercel settings.
6. On any device, open the deployed URL, open **Analyze**, and follow **Sign in** if prompted. Username: **nutriar**. Password: the `APP_PASSWORD` you configured. The Gemini key remains on the server and is shared across sessions; users do not enter or save it in the app.
7. After setting/changing environment variables, **redeploy** so the running functions receive them.

`api/config.js`, `api/analyze.js` and `api/auth.js` are Vercel Functions; `vercel-api.mjs` provides the password check and forwards requests to the shared Gemini API handler. The paid API fails closed until `APP_PASSWORD` is configured. The static interface contains no key and remains separate from API authentication. To restrict the entire interface too, enable Vercel Deployment Protection for the intended environments.

Photo uploads are resized in the browser; prepared images are capped at 3 MB to fit Vercel's request-body limit after base64 encoding. The API key is never included in a browser request or response, diary state or backups. Diary data keeps a browser copy and syncs through the separate authenticated `/api/diary` endpoint when Upstash Redis is connected.

### Current deployment access limitation

The live project is deployed at https://caltracker-brown.vercel.app/ through GitHub pushes. The connected Vercel account exposes the **FulFillOS** team but returns 404 for this project/alias, so it cannot inspect the owner’s live environment variables or billing plan. Use the authenticated in-app database check to verify the actual storage connection; never paste keys or passwords into chat.

## Run locally
Requires Node 22+. Run `npm ci` to install the server-side Redis client.
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

Photos are not persisted by NutriAR and are sent to Google Gemini only when Analyze is clicked. Provider handling is governed by the Google AI Studio project's data settings; NutriAR does not request persistent Gemini conversation state; provider retention and processing follow your Google AI Studio project terms. Only the confirmed nutrition estimate is saved in the diary, including cloud storage when enabled. Photo estimates are approximate, particularly for hidden fats and ambiguous portions.

### Server configuration
Set `GEMINI_API_KEY` privately on the hosting provider. Never put it in client code, GitHub, `.openai/hosting.json`, or a committed `.env`. `GEMINI_MODEL` defaults to `gemini-flash-latest`, a vision/structured-output capable model. The server reports readiness without exposing the key. Valid API access and billing are required. Configure project budgets/usage controls in the Google AI Studio account.

- **Live Sites app:** `scripts/build-worker.mjs` bundles all browser assets and the API into `dist/server/index.js`. Preserve the selected project ID in `.openai/hosting.json` and remove `static` when publishing the Worker. The Sites secret configuration supplies the key at runtime. Site authentication protects the app; paid analysis additionally requires the authenticated visitor header supplied by Sites. The current Site remains owner-private.
- **Node deployment:** deploy `server.mjs`, `api.mjs` and `dist/`. Set `HOST=0.0.0.0`, `APP_PASSWORD` and the host's `PORT`. Username: `nutriar`. Use HTTPS. If behind an HTTPS proxy, set `PUBLIC_ORIGIN` to the exact public HTTPS origin so origin checks match.
- **GitHub Pages/static hosting:** serves the diary but cannot execute the API. Use Node or the hosted Worker to enable photo analysis. The included Pages workflow is manual and does not change repository visibility.

The endpoint checks identity (Sites), origin, JSON size, image format/magic bytes and model output. One analysis at a time and 20 attempts/hour are enforced per actor **per process/Worker isolate**. These are best-effort controls, not durable global quotas; restarts and multiple isolates reset or distribute those limits. Use provider project controls for spending limits. Provider calls time out after 45 seconds; the UI supports retry and manual entry.

## Local diary and food data
Diary entries are keyed by date and retain meals/calories/macros, water, notes and activity. Weight history, custom foods and current goals are also saved. A browser copy remains available while offline; export/import JSON backups remain supported.

### Enable private cross-device saving on Vercel

1. In your **caltracker** Vercel project, open **Storage → Create Database → Upstash Redis** (Marketplace).
2. Connect the database to the project’s **Production** environment. The integration supplies `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; keep both server-only. Use a separate database for previews to avoid modifying your real diary from test deployments.
3. Redeploy, then open the app on the device that already has your entries. Select **Sign in to sync** with username `nutriar` and `APP_PASSWORD`.
4. Wait for **Saved on this device and in cloud**, then sign in at the same website on your other device. Existing local history migrates automatically; different dates and entry IDs merge. Conflicting edits require an explicit choice and download a backup before either copy is replaced.

The authenticated `/api/diary` Function saves a persistent owner document with atomic revision checks, no expiration, a 2 MB limit, and `private, no-store` responses. Browser refresh, connectivity restoration, returning to the tab, and a visible-tab 60-second refresh trigger sync. Changes sync after a short debounce. Database credentials never enter the browser, backups or source control. This is one personal diary shared by devices using the same owner password; it is not a multi-user account system.

Without a connected database or sign-in, data remains on the device and the status explicitly says so. Do not clear browser data until cloud saving is confirmed or a JSON backup is exported. The legacy Sites Worker does not implement cloud diary storage; this route is supported by the Vercel and password-protected Node hosts.

37 generic starter foods use approximate nutrition per stated serving. 52 foods transcribed from the uploaded video preserve visible calorie values; the two opened detail screens also provide macros. Missing macros/unspecified weights are null, not zero. The diary marks partial macro totals. See [VIDEO-FOODS.md](VIDEO-FOODS.md) for the full transcription. Check package labels for precise nutrition.

## Interface
Dark-first obsidian design, layered calorie meter, unboxed macros, date capsules and floating dock. The theme toggle stores an optional light preference. Activity calories add to the daily energy budget; reduced motion is supported. See [DESIGN.md](DESIGN.md).

## API and verification
`api.mjs` is shared between Node and Worker, so request validation and provider behavior stay consistent. Tests cover provider request shape with a mocked response, credential failures, refusal/non-food handling, timeouts, quotas, image validation, built Worker asset/API routing and the existing diary calculations. A successful test suite does **not** verify a live provider key. Live photo estimation must be verified after the runtime key is configured.

Gemini references: [image inputs](https://aistudio.google.com/docs/image-understanding), [structured outputs](https://aistudio.google.com/docs/structured-output) and [Interactions API](https://aistudio.google.com/docs/interactions-overview).

### Gemini compatibility and diagnostics
The backend starts with `GEMINI_MODEL` (default `gemini-flash-latest`). You can explicitly set `gemini-4-hydrogen` if your Google project grants access. Enter only the ID in Vercel, without quotes or `model=`. The `models/` prefix is normalized if supplied.

If Google returns 404, the backend lists models using the **same server key**, follows up to five catalog pages, filters out non-generation and specialized audio/image-generation models, and tries at most two catalog-advertised alternatives. A successful selection is cached for five minutes per process and invalidated when the key or configured model changes. Catalog visibility is not a guarantee of inference entitlement: if Google advertises models but still rejects generation, the app reports an account/API-access problem rather than recommending another guessed model.

Unsupported schema configuration retries once with a minimal request and explicit JSON instructions; server nutrition validation still applies. Google HTTP status is returned as `providerStatus` alongside a specific error code. Server logs contain only status/code, never the key, meal notes, photo, or raw upstream message.

### Photo error diagnostics
Photo failures show a bracketed diagnostic with the app error code, Gemini HTTP status, a sanitized Google status enum when available, and the failing step (`generation` or `model_catalog`). Share that text when reporting a failure. The backend logs the same safe fields as `gemini_request_failed`; it does not expose raw upstream messages or credentials. A passing mocked test suite does not establish that the deployed project's live Gemini requests succeed.

### Temporary Gemini overloads
For HTTP 500/502/503/504, the backend makes one short retry before trying an alternative model returned by Google's catalog for the same key. Recovery is capped at **four inference attempts total** and shares the existing **45-second deadline**. Authentication, quota, photo-safety and invalid-estimate failures are not automatically retried. A `Retry-After` greater than two seconds prevents immediate retries/failover. Only a successful, validated estimate can reach the review form; failures never create diary entries. A recovered model is cached for five minutes per process.

## Visual identity and languages

The current app uses a warm ink/citrus/peach palette, an optional parchment light theme, Fraunces editorial headings and Manrope/DM Sans UI text. `dist/brand.css` contains the new design tokens and component adjustments. `dist/assets/brand/` contains the original SVG logo/mark, iPhone home-screen icon and locally hosted editorial hero image. `dist/favicon.ico` supplies the fallback browser icon. Matching custom SVG icons render in the diary, food library, macro readouts and welcome page.

The diary stays at `/`; `/welcome.html` is the bilingual introduction. The ES/EN selector remembers a per-device language preference; visible UI text, supported dynamic status strings, dates and number formatting are localized. Translation never rewrites diary values, food names, notes or internal meal/category keys. `dist/i18n.js` owns the English-to-Spanish UI copy. No paid translation service, runtime design plugin or animation subscription is used. Generated artwork is stored in the project and does not require an ongoing service.

## Database connection check

Select **Check cloud / Comprobar nube** in the saving bar. The authenticated, same-origin `POST /api/storage-status` route writes a unique, 60-second temporary key, reads it back, deletes it and reports saved-day count/revision without exposing diary content or credentials. It never edits the diary document. Both `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` and the Marketplace `KV_REST_API_URL` / `KV_REST_API_TOKEN` naming schemes are supported. Missing Production variables require connecting the database and redeploying. A successful deployment is not proof of a working database: confirm the live read/write check after sign-in.

## Apple Health through a personal iPhone Shortcut

Select **Connect Apple Health / Conectar Apple Health** in the diary for the English/Spanish setup guide. Safari cannot read HealthKit. The owner signs in, creates a 90-day connection token, then builds a Shortcut on their iPhone to send daily `date`, `steps` and `activeKcal` values as JSON to `POST /api/health` using a Bearer token. `date` uses the diary’s Buenos Aires calendar. Read only the chosen source’s samples for today, with active energy in kcal; overlapping Watch/iPhone samples must not be summed. Results can differ from Health’s merged aggregate. No-sample results must not be invented as zero.

Tokens are HMAC-signed using the private app password and are restricted to Health imports. They cannot read diary data, log meals, invoke AI or issue more tokens. Changing `APP_PASSWORD` revokes all such tokens. Tokens are shown only when generated, are not persisted by the web app, and must not be shared with another person or included in a public Shortcut. Imports overwrite daily Health totals, retain meals/notes/manual activity and use atomic revision checks against simultaneous browser edits. Active calories replace manual activity in the daily budget unless the user explicitly selects manual activity. Steps are displayed without converting them into an extra calorie allowance. The current Health endpoints are deployed as Vercel Functions; no native iOS app or paid Apple membership is needed for the Shortcut approach.

The Shortcuts automation is configured on the actual iPhone. No signed `.shortcut` download or preconfigured automation is provided. No paid integrations are provisioned by this implementation; use your existing Vercel and Upstash free-tier plans and Google’s free API quota where available. Free-tier limits and current account billing plans remain controlled in those service dashboards.

## Optional text-based AI suggestions

**Log food → Estimate a meal with AI** accepts a short meal/portion description and uses the existing authenticated Gemini integration through `/api/estimate`. Suggestions show editable calories/macros, confidence and assumptions and require **Confirm & log meal**. In **Create a food**, fill the name/serving and select **Suggest calories & macros**, then **Use suggestion** to copy reviewed values into the form; weight remains a manual input. Nothing is logged automatically, requests run only on an explicit button press, and changing the food/portion invalidates a pending suggestion. Text estimates reuse image analysis validation, the same per-actor request limit, bounded recovery and server-only credentials. Tests mock Gemini; no paid provider request is made during automated verification.

General food additions default to the current Argentina time: Breakfast 05:00–10:59, Lunch 11:00–14:59, Merienda 15:00–18:59, Dinner 19:00–04:59. The selector is always editable, and a specific meal’s add button preserves that meal. These are UI defaults, not nutritional recommendations. The diary opens with the energy gauge as its visual focus; translucent date controls remain at the top while scrolling, and branding/global controls are below the content.
