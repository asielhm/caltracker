# NutriAR — In focus

The supplied neon diary mockup is the structural baseline: diary title, interactive date capsule, daily goal, central energy meter with Eaten and Burned on either side, macro readouts, meal logging, Analyze, and a floating navigation dock.

## Composition

Desktop uses one continuous dashboard with a fine vertical boundary between energy and meals. On mobile, the sections flow into a single vertical composition. Calories dominate through scale, contrast and position. Macros are unboxed data readouts with shared alignment, rather than separate cards. Water, notes and the Argentine library form a secondary strip. No phone frame, fake user history, notifications or unsupported meal-plan navigation are included.

## Color and material

Obsidian `#0c0f13`, metallic charcoal surfaces and subtle ambient color form the base. Green `#80f8a6`, cyan `#56e5ed` and violet `#b79bff` distinguish actions and nutrient types. Glass is restricted to the dock, date selection and small controls. The main canvas remains legible and structurally clear without blur. An optional light theme is available; this design starts dark on a fresh visit and stores its preference under `nutriar-neon-theme`.

## Meter and motion

The energy meter combines an outer segmented orbit, a static accent arc, a track, a blurred progress layer, a sharp gradient progress layer and an inset central disc. Every progress layer uses the real diary totals. There are no continuously rotating rings, particles or ornament animations.

Food logging interpolates the numeric totals and both ring layers over 650 ms; the changed meal receives a brief tint. A known macro or water goal crossing produces a single short halo confirmation with a text toast. Hover, focus and pressed states give feedback on the date controls, Analyze, food actions and dock. Reduced-motion preferences disable movement while retaining text and state changes. Animation holds references to its original nodes so switching dates during a transition cannot overwrite another day's display.

## Function

- Three date pills are based on the currently selected day. Previous/next arrows and a native calendar remain available. Dates are calculated at UTC noon to avoid timezone-boundary drift.
- Eaten comes from actual diary entries. Burned opens a manual activity-calorie entry. Remaining = daily goal + activity calories − eaten. Activity calories are estimates supplied by the user; no device integration is implied. Legacy diaries without activity values use zero.
- Analyze and Scan open the existing camera/upload and reviewed-estimate flow. Missing AI credentials remain explicitly indicated.
- Dock controls navigate to real diary, food library, progress and goals views; the central action opens food logging.
- The existing 89 foods, unknown macro handling, local persistence and backup import/export remain supported.

## Code

`dist/style.css`: theme tokens, cardless dashboard, SVG meter styling, dock, forms, responsive breakpoints and reduced motion.

`dist/app.js`: composition, diary interactions and activity editing.

`dist/ui.js`: icons, date helpers, persistent theme and feedback.

`dist/nutrition.js`: pure calorie balance and nutrition calculations.

`dist/index.html`: dark-first bootstrap, app shell, action dock and dialog accessibility.

## Validation

`npm run check` checks JavaScript syntax. `npm test` covers catalog and nutrient behavior, server assets, theme state, first-visit dark mode, date boundaries including leap years, activity-adjusted calorie balance and final counter/ring animation values. The managed preview relay could not open its browser port, so browser visual verification is incomplete.
