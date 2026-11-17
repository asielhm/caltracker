# NutriAR — Daily rhythm

## Design analysis and direction

The earlier interface relied on white cards, small labels and green progress bars. It gave the food library, calories, macros and secondary information almost equal visual weight. The refresh makes the daily diary the primary experience and uses a food/editorial identity rather than a clinical fitness identity.

Patterns considered before implementation:

- **Bento grids:** use unequal tile sizes to make hierarchy visible. Calories occupy the largest tile, the meal scanner gets photographic contrast, and macros share three smaller tiles. The mobile composition deliberately rearranges the scanner and hydration tile below macros rather than shrinking the desktop layout.
- **Typography pairings:** Manrope supplies clear numeric forms and tabular figures; Instrument Serif adds personality to short headlines; DM Sans handles UI copy. System and Georgia fallbacks keep the app usable without the remote font service.
- **Glass:** limit translucency to the mobile navigation and the photographic scan badge. Solid surfaces keep numbers and forms readable.
- **Organic rhythm:** soft corners, a circular energy dial, a slightly rotated local-food stamp, warm tones and real food photography provide personality without decorative scrolling, heavy 3D libraries or cursor effects.
- **Purposeful motion:** counter interpolation uses existing and new totals; a meal card briefly highlights after logging. Known macro target crossings and water target crossings trigger a short celebration. The app does not fabricate progress or encourage eating past a calorie target.

Reference material reviewed: [Awwwards design presentation](https://assets.awwwards.com/assets/files/live-presentation.pdf), [Awwwards Hot Right Now](https://assets.awwwards.com/awards/gallery/2023/07/HOT-RIGHT-NOW-BOOK-2023.pdf), and [WebKit: Responsive Design for Motion](https://webkit.org/blog/7551/responsive-design-for-motion/). These informed the design choices; they are not a claim that this app has won an award.

## Implementation map

- `dist/style.css`: semantic theme tokens, bento layouts, all responsive breakpoints and interaction styling. Main colors: warm parchment, deep aubergine, tangerine, lilac, oat and slate blue.
- `dist/index.html`: navigation, theme bootstrap before the stylesheet, skip link and persistent shell.
- `dist/app.js`: dashboard composition and existing app behavior.
- `dist/ui.js`: inline SVG icons, theme toggle, counter motion and goal feedback. No UI framework or animation dependency.

Light/dark follows system preference on the first visit; the header toggle persists an explicit choice under `nutriar-theme`. It updates accessible labels and browser theme color. Nutrition data and existing browser diary storage retain their original keys.

Motion uses transform/opacity for entrances and feedback, a short 650 ms numeric transition, and a 1.5 second decorative celebration. `prefers-reduced-motion: reduce` disables animations and smooth scrolling. Goal confirmations remain available as text. Keyboard focus is visible, dialog labeling is explicit, charts have accessible labels, macro meters have values, and partial data stays visibly marked.

## Photography

Food photo: [Unsplash image](https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38). A locally stored, resized copy is used in `dist/assets/meal.jpg` so image rendering does not depend on a runtime image service.

## Validation

`npm run check` validates JavaScript syntax. `npm test` covers app and asset serving, the food catalog, unknown nutrient handling, theme persistence and accessibility labels, target crossing logic, and reduced-motion counter behavior. The managed preview relay could not open its browser port in this environment, so browser visual QA remains unverified.
