# Chubb APAC — Claims & Liability Exposure Portal (Angular 19)

Frontend single-codebase Angular 19 application serving both **Claimants (Policyholders)** and **Chubb Claims Staff (Claims Officers & Claims Managers)**.

> **Backend Repository (`chubb-api`)**: Contains the `.NET 10` Clean Architecture (`IDispatcher` CQRS) API, Transactional Outbox + Kafka/SignalR worker, SpecKit specifications (`.specify/` & `specs/`), and the `AI_WORKING_JOURNAL.md`.

## Quick Start

1. Ensure `chubb-api` is running on `http://localhost:5150`:
   ```bash
   dotnet run --project src/Chubb.Claims.Api/Chubb.Claims.Api.csproj --urls "http://localhost:5150"
   ```
2. Install dependencies & start the Angular dev server (`http://localhost:4200`):
   ```bash
   npm install
   npm start
   ```

## Dual-Persona Architecture in a Single Angular Codebase
Use the **Active Persona** switcher in the top navigation bar to switch live between:
- **Claimants** (`Tan Wei Ming - SG`, `Chloe Chan - HK`, `Liam O'Connor - AU`): Self-service FNOL reporting, 4-stage visual claim tracker, and responding to officer information requests.
- **Claims Officers** (`Sarah Jenkins - SG/HK`, `Rajesh Patel - AU/MY`, `Narong Srisai - TH/ID`): Multi-market triage queue, 1-click claim pickup, dynamic reserve adjustment (`AssessedReserve`), confidential adjuster notes, information requests, and settlement/rejection decisions.
- **VP Claims Manager** (`Victoria Lim - APAC`): Real-time consolidated USD & native-currency **Outstanding Liability Exposure** across all 6 APAC markets (`SG`, `HK`, `AU`, `MY`, `TH`, `ID`), team workload matrix, and live Outbox -> Kafka/SignalR domain event ticker.
