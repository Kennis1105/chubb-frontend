# Chubb APAC Claims Frontend

Angular frontend for the Chubb APAC Claims demo. The claimant view supports claim submission, status tracking, and responses to information requests. The claims officer view supports claim pickup, reserve assessment, information requests, and settlement or rejection.

## Run locally

Keep this repository beside `chubb-api`. Start the API on `http://localhost:5150` first. The README in the sibling `chubb-api` repository has the full first-time setup, including optional local Kafka.

From `chubb-frontend`:

```bash
npm ci
ng serve
```

Open `http://localhost:4200`. Use the buttons in the top bar to switch between the claimant and officer views. The app gets claim data through REST and refreshes when it receives SignalR events from the API.

If `ng` is not found, install the Angular 19 CLI with `npm install -g @angular/cli@19`.

## Build

```bash
npm run build
```

The frontend starts with `src/main.ts`. `src/app/app.component.ts` contains the current screens and actions; `src/app/services/claims-api.service.ts` handles API and SignalR connections; `src/app/models/claims.models.ts` defines the response shapes.
