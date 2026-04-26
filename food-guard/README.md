# Food Guard

Food Guard is a private, local-first Expo React Native app for family barcode and ingredient-label checks. It is intentionally conservative: if ingredient data is missing or unclear, it says `Unknown — check label manually` or `Possible Risk` instead of pretending the food is safe. Revolutionary concept: not lying to the user.

## Primary Recommendation

Use a custom Expo development build. The OCR dependency is native ML Kit, so Expo Go is not enough.

```bash
cd "/Users/biscuitdh/Projects/Kosher Site/food-guard"
npm install
npm run prebuild
npm run ios
```

For Android:

```bash
cd "/Users/biscuitdh/Projects/Kosher Site/food-guard"
npm install
npm run prebuild
npm run android
```

## Physical Devices

Barcode scanning and camera OCR are best tested on real devices.

```bash
npm run start
```

Then open the development build on the phone and connect it to the Metro server.

## What It Does

- Family profiles with tomato and nightshade rules enabled by default.
- Optional kosher preferences:
  - kosher required
  - accepted symbols such as OU, OK, Star-K, Kof-K
  - pareve required
  - Passover mode
- UPC/EAN barcode scanning with `expo-camera`.
- Product lookup through Open Food Facts API v2.
- Local product cache, scan history, favorites, and manual family notes using Expo SQLite.
- On-device OCR through `@infinitered/react-native-mlkit-text-recognition`.
- Deterministic rule engine with source-attributed matches.
- No account, no custom backend, no family allergy profile upload.

## Conservative Result Logic

- `Avoid`: definite tomato or nightshade term found.
- `Possible Risk`: ambiguous term found, such as `pepper`, `spices`, `natural flavors`, `seasoning`, `vegetable powder`, or `flavoring`.
- `Likely OK`: ingredient or OCR text exists and no definite or ambiguous match was found.
- `Unknown`: no ingredient data, failed lookup, failed OCR, or insufficient data.

Black pepper and white pepper are not flagged by default. Generic `pepper` is treated as `Possible Risk`.

## Open Food Facts

Food Guard uses:

```text
https://world.openfoodfacts.org/api/v2/product/{barcode}.json
```

The lookup sends only the barcode and a custom User-Agent. Read operations do not require authentication. Responses are cached locally.

Mock barcodes for development:

```text
000000000001  Mock Tomato Pasta Sauce       => Avoid
000000000002  Mock Plain Rice Crackers      => Likely OK
000000000003  Mock Seasoned Chips           => Possible Risk
```

## Tests

```bash
npm run typecheck
npm run test
```

The tests cover:

- `tomato paste` => `Avoid`
- `paprika` => `Avoid`
- `black pepper` => `Likely OK`
- `pepper` => `Possible Risk`
- `spices` => `Possible Risk`
- missing ingredients => `Unknown`
- `potato starch` => `Avoid`
- `natural flavors` => `Possible Risk`
- accent normalization such as `jalapeño` and `tomato purée`
- Open Food Facts response handling with mocked fetch

## Security And Privacy Notes

- No account required.
- No custom backend.
- Allergy profiles, scan history, OCR text, favorites, and notes stay in local SQLite.
- OCR is on-device in the custom development build.
- Only barcode lookup requests go to Open Food Facts.
- Kosher output is informational and conservative. The app says `Kosher indicator found` or `Kosher status unknown — check package symbol`; it does not claim certification unless source text clearly supports it.
- Passover mode never assumes regular kosher certification is enough.

## Alternatives

1. Expo Go MVP: easier setup, but no native OCR.
2. Cloud OCR: easier OCR integration, worse privacy.
3. Root replacement: not used; the existing KosherTable web app is left untouched.
