# NutriAR
A responsive calorie and macro diary inspired by the supplied Calo screenshots and video. No dependencies; Node 22+ for optional server features.

## Run
```
npm start
```
Open http://127.0.0.1:3000. `npm run check` validates syntax; `npm test` checks server behavior and food data.

## Features
- Daily calorie, protein, carbohydrate and fat totals with editable targets.
- Breakfast, lunch, merienda and dinner logging; servings or gram adjustments; remove entries.
- 89 foods: 37 generic Argentine/everyday foods and 52 entries transcribed from your video, searchable with accent-insensitive matching.
- Custom foods with label values, water tracking, daily notes, weight history and 7-day calorie progress.
- Local browser persistence with JSON backup export/import. No account or cross-device sync. Empty initial diary; no fabricated user history.
- Camera/upload flow with editable AI estimates before logging, or manual estimates when AI is unavailable.

## Optional AI photo analysis
The static preview and GitHub Pages cannot run the AI endpoint. Deploy `server.mjs` to a Node host and set `OPENAI_API_KEY` privately in its environment. The app never receives this key. The endpoint uses the OpenAI Chat Completions vision API; set `OPENAI_MODEL` to another compatible vision model if needed. Actual provider calls require a valid key and billing; they have not been tested with live credentials.

For a network host, set `HOST=0.0.0.0`, `APP_PASSWORD` to a strong private password, and `PORT` as required by your host. The username is `nutriar`. Serve over HTTPS. Password authentication protects the app and paid AI endpoint; analysis also checks origin, limits requests per IP, caps upload size, times out requests, and validates model results. In-memory rate limits reset on restart and are not a substitute for shared quotas on multi-instance hosts.

Images are sent to OpenAI only when Analyze is clicked. Images are not saved by this app, and only the user-confirmed estimate is added to the diary. Do not paste API keys into GitHub or the browser.

## Nutrition data
`dist/foods.js` contains generic starter estimates per displayed serving, not verified Argentine brand labels or a clinical database. Prepared dishes vary greatly by recipe, edible portion and cooking fat. Values are approximate and calories may differ from simple 4/4/9 arithmetic due to rounding and fiber. Check packaging or a trusted composition database and enter custom foods for precise tracking. The “From your video” category preserves 52 saved entries and their visible calorie values. ISO GOLD and the Union Ganadera milanesa also include the visible macros. These are user-video transcriptions, not verified manufacturer labels. Missing macros and unknown weights are stored as null. Logging these foods adds calories and known macros; the diary flags incomplete macro totals. Only explicitly stated serving weights enable gram scaling. See [VIDEO-FOODS.md](VIDEO-FOODS.md) for the full transcription and timestamps.

## GitHub and hosting
Push this directory to the selected GitHub repository. All client assets are in `dist/`; any static host can serve them without a build. A GitHub Pages workflow is included; enable Settings → Pages → Source: GitHub Actions. Private repository Pages availability depends on your GitHub plan, and published Pages may be publicly accessible: configure visibility deliberately before enabling it. The workflow is manual so pushing code does not publish health data or change repository visibility. Diaries stay only in each browser, not in GitHub.

For AI, deploy the Node server instead of GitHub Pages. `.openai/hosting.json` is metadata for the separate Sites preview and can be omitted for other hosts.

## Interface and themes
The In Focus design follows the supplied neon mockup with an obsidian canvas, layered cyan/green calorie meter, unboxed macro readouts, interactive date capsules and a floating action dock. Dark mode is the default; the header toggle remembers an optional light preference. Burned calories can be manually logged and add to the daily energy budget. Logging updates counters and ring layers, with reduced-motion support. See [DESIGN.md](DESIGN.md) for architecture, interactions and verification limits.
