# KGS (working title)

Personal tracker for body values and strength training. Android first, built with Expo so it runs in **Expo Go** without building an APK.

## Run it on your phone (Expo Go)

1. Install **Expo Go** from the Play Store on the phone.
2. On a computer with Node.js 20+:
   ```bash
   git clone https://github.com/McQuartz/KGS.git
   cd KGS
   npm install
   npx expo start            # phone and computer on the same Wi-Fi
   # or, if the phone is on another network:
   npx expo start --tunnel
   ```
3. Scan the QR code shown in the terminal with Expo Go.

Optional, without a running computer: publish an update with EAS (`npx eas-cli@latest login`, `npx eas-cli@latest update:configure`, `npx eas-cli@latest update --branch preview`) and open it in Expo Go via the link/QR on expo.dev.

Want to try it with data right away? Settings → Data → **Demo data** generates ~6 months of sample entries (removable with the same switch).

## Features

- **Body values**: weight (daily, robust trend that ignores single outlier days), body fat, waist, muscle mass, any custom metric.
- **Training**: start an empty workout → choose type → add exercises one by one → log weight, reps, rest and notes per set. Templates are optional (load inside a workout or start from the Train tab). Warm-up sets can be enabled (marked separately, never counted in stats). Log mode: all sets or only the daily best. Rest timer. Values are prefilled from last time.
- **Analysis**: weight rate (kg/week) + goal forecast, PR detection, strength index (% vs. your own baseline per exercise, so heavy and endurance work can be combined), rep ranges 1–5 / 6–12 / 13+, stronger / holding / declining status (median-based), plateau detection, volume per muscle group per week, strength relative to body weight, consistency. Estimated 1RM is optional and off by default. Insights appear behind the bulb icon on the home screen.
- **Charts**: labeled axes, trend line, chart type switch (line / dots / weekly bars), free range, pinch-zoom and pan.
- **Settings**: theme Ash (default) or Stone, light/dark/system, English/Deutsch, metric/imperial, input method (number pad / drum wheel / +/- buttons), dashboard cards and history series order, export/import (JSON, CSV), demo data.

All data stays on the device (SQLite). No account, no sync yet.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # unit tests for the analysis module (vitest)
```

Structure:

- `src/app` – screens (Expo Router)
- `src/analysis` – pure analysis logic + tests
- `src/db` – SQLite schema/migrations (`db.ts`) and data access (`repo.ts`)
- `src/lib` – formatting/units, insights glue, backup, demo data
- `src/components` – UI primitives, charts, number inputs, screen parts
- `src/i18n` – EN/DE strings per area
- `src/theme` – Ash and Stone tokens (light + dark)
