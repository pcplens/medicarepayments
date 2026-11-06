# Medicare Payments to Primary Care

An interactive PCP Lens tool showing monthly Medicare fee-schedule payments from 1992 through 2027 for a configurable independent primary-care practice.

Adjust QP/non-QP status, visit mix, monthly volume and complexity-code use. Compare nominal payments, CPI-adjusted payments, MEI-adjusted payments and conversion factors across four selected years. Chart events explain significant policy and RVU changes.

The website serves a versioned public data snapshot. It does not query a live database. Sources, calculation assumptions and inflation projections are available within the app and exported CSV.

## Run locally

Requires Node.js 20+ for calculation tests and Python 3 for the local HTTP server.

```sh
npm test
npm run preview
```

Open http://127.0.0.1:8878/. No build step is required.

Browser validation uses Playwright with headless system Google Chrome over local HTTP and saves assertions and screenshots to `qa/`. Install Playwright separately, then run `npm run test:browser`. Optional environment variables: `CHART_PLAYWRIGHT_MODULE`, `CHART_CHROME_EXECUTABLE`, `QA_OUTPUT`.

## Deploy

The GitHub Actions Pages workflow publishes `dist/` on pushes to `main`. Enable GitHub Pages with **GitHub Actions** as the source in repository settings. A custom subdomain can be configured in Pages settings; its DNS CNAME should point to `pcplens.github.io`.

## Assets

Brand assets belong to PCP Lens. The bundled Montserrat and Merriweather fonts include their respective OFL license files in `dist/assets/fonts/`.
