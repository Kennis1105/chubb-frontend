import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClaimsApiService } from './services/claims-api.service';
import {
  ClaimDetail,
  ClaimSummary,
  ExposureAnalytics,
  MarketMetadata,
  Persona
} from './models/claims.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- TOP BAR -->
    <header class="topbar">
      <div class="brand-group">
        <span class="chubb-wordmark">CHUBB</span>
        <div>
          <div style="font-weight: 700; font-size: 0.92rem; color: #f8fafc;">APAC Claims & Liability Exposure Platform</div>
          <div class="platform-subtitle">Unified Angular Portal • .NET 10 Clean Architecture (` + '`IDispatcher`' + `) • Outbox + Kafka/SignalR</div>
        </div>
      </div>

      <div class="topbar-controls">
        <!-- Real-Time SignalR / Event Stream Indicator -->
        <div class="signalr-pill" [style.opacity]="api.signalRConnected() ? '1' : '0.6'">
          <span class="signalr-dot"></span>
          <span>{{ api.signalRConnected() ? 'Outbox -> Kafka/SignalR Live' : 'REST Polling Mode' }}</span>
        </div>

        <!-- Single Codebase Persona Switcher -->
        <div class="persona-switcher" *ngIf="activePersona() as persona">
          <span class="persona-label">Active Persona:</span>
          <select
            class="persona-select"
            [ngModel]="persona.id"
            (ngModelChange)="onSelectPersona($event)">
            <optgroup label="Policyholders / Claimants (Self-Service Portal)">
              <option *ngFor="let p of claimantPersonas()" [value]="p.id">
                {{ p.name }} — {{ p.market }} ({{ p.role }})
              </option>
            </optgroup>
            <optgroup label="Chubb Claims Staff (Workbench & Exposure)">
              <option *ngFor="let p of staffPersonas()" [value]="p.id">
                {{ p.name }} — {{ p.market }} ({{ p.role }})
              </option>
            </optgroup>
          </select>
          <span
            class="role-badge"
            [ngClass]="{
              'role-claimant': persona.role === 'Claimant',
              'role-officer': persona.role === 'ClaimsOfficer',
              'role-manager': persona.role === 'ClaimsManager'
            }">
            {{ persona.role }}
          </span>
        </div>
      </div>
    </header>

    <main class="container" *ngIf="activePersona() as persona">
      <!-- PERSONA CONTEXT BAR & VIEW TABS -->
      <div class="persona-context-bar">
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <strong style="font-size: 1.02rem;">{{ persona.name }}</strong>
            <span style="color: var(--text-muted); font-size: 0.85rem;">• {{ persona.title }}</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">
            <span *ngIf="persona.role === 'Claimant'">
              Viewing personal policy claims ({{ persona.market }}). Internal adjuster notes are automatically masked by the API.
            </span>
            <span *ngIf="persona.role !== 'Claimant'">
              Authorized Staff Access ({{ persona.market }}). Full access to triage queue, reserve adjustments, settlement authority, and APAC liability exposure.
            </span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <!-- View Switcher for Staff -->
          <div class="nav-tabs" *ngIf="persona.role !== 'Claimant'">
            <button
              class="nav-tab"
              [class.active]="activeStaffTab() === 'workbench'"
              (click)="activeStaffTab.set('workbench')">
              Claims Officer Workbench ({{ claims().length }})
            </button>
            <button
              class="nav-tab"
              [class.active]="activeStaffTab() === 'analytics'"
              (click)="switchToAnalyticsTab()">
              APAC Liability Exposure & Team Workload
            </button>
          </div>

          <!-- Claimant FNOL Button -->
          <button
            *ngIf="persona.role === 'Claimant'"
            class="btn btn-primary"
            (click)="openFnolModal()">
            + Report New Incident (FNOL)
          </button>

          <button class="btn btn-outline" (click)="refreshAll()">
            Refresh Data
          </button>
        </div>
      </div>

      <!-- TOAST / FEEDBACK BANNER -->
      <div
        *ngIf="toastMessage()"
        style="background: #0f172a; color: #f8fafc; padding: 0.75rem 1.15rem; border-radius: 8px; margin-bottom: 1.15rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.84rem; border-left: 4px solid #10b981;">
        <span>{{ toastMessage() }}</span>
        <button class="btn btn-outline" style="padding: 0.2rem 0.55rem; font-size: 0.72rem;" (click)="toastMessage.set(null)">Dismiss</button>
      </div>

      <!-- ========================================================================= -->
      <!-- VIEW 1: EXECUTIVE APAC LIABILITY EXPOSURE & TEAM WORKLOAD (STAFF/MANAGER) -->
      <!-- ========================================================================= -->
      <section *ngIf="persona.role !== 'Claimant' && activeStaffTab() === 'analytics' && analytics() as exp">
        <!-- Executive KPI Strip -->
        <div class="kpi-grid">
          <div class="kpi-card highlight-navy">
            <div class="kpi-title">Outstanding Liability Exposure (USD)</div>
            <div class="kpi-value mono">\${{ exp.totalActiveLiabilityExposureUsd | number:'1.0-0' }}</div>
            <div class="kpi-sub">{{ exp.openClaimsCount }} Active Open Claims across 6 APAC Markets</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-title">Realized Settled Payouts (USD)</div>
            <div class="kpi-value mono" style="color: #047857;">\${{ exp.totalSettledPayoutsUsd | number:'1.0-0' }}</div>
            <div class="kpi-sub">{{ exp.settledClaimsCount }} Claims Settled & Reserve Cleared</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-title">Released Reserves (Rejected)</div>
            <div class="kpi-value mono" style="color: #64748b;">\${{ exp.totalReleasedReservesUsd | number:'1.0-0' }}</div>
            <div class="kpi-sub">{{ exp.rejectedClaimsCount }} Claims Rejected without Payout</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-title">Queue Bottlenecks</div>
            <div class="kpi-value mono" style="color: #b45309;">
              {{ exp.unassignedClaimsCount }} <span style="font-size: 0.9rem; font-weight: 600;">Unassigned</span> /
              {{ exp.awaitingClaimantInfoCount }} <span style="font-size: 0.9rem; font-weight: 600;">Awaiting Info</span>
            </div>
            <div class="kpi-sub">Total Claims Processed: {{ exp.totalClaimsCount }}</div>
          </div>
        </div>

        <div class="workspace-split" style="margin-bottom: 1.25rem;">
          <!-- 6-Market Multi-Currency Breakdown -->
          <div class="panel-card">
            <div class="panel-header">
              <div>
                <div class="panel-title">APAC 6-Market Liability Exposure (Native Currency & Normalized USD)</div>
                <div style="font-size: 0.76rem; color: var(--text-muted);">
                  Active Reserve = AssessedReserve (if reviewed by officer) or Claimant EstimatedLoss
                </div>
              </div>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Open / Total</th>
                  <th>Active Reserve (Native)</th>
                  <th>FX Rate</th>
                  <th>Active Exposure (USD)</th>
                  <th>Settled (USD)</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let m of exp.byMarket">
                  <td>
                    <span class="market-pill">{{ m.market }}</span>
                    <strong style="margin-left: 0.45rem;">{{ m.countryName }}</strong>
                  </td>
                  <td>{{ m.openClaimsCount }} / {{ m.totalClaimsCount }}</td>
                  <td class="mono">{{ m.currency }} {{ m.activeReserveNative | number:'1.0-0' }}</td>
                  <td class="mono" style="color: var(--text-muted);">{{ m.fxRateToUsd }}</td>
                  <td class="mono" style="font-weight: 700; color: #0f172a;">\${{ m.activeReserveUsd | number:'1.0-0' }}</td>
                  <td class="mono" style="color: #047857;">\${{ m.settledPayoutUsd | number:'1.0-0' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Team Workload & Officer Performance Matrix -->
          <div class="panel-card">
            <div class="panel-header">
              <div>
                <div class="panel-title">Claims Officer Workload & Performance</div>
                <div style="font-size: 0.76rem; color: var(--text-muted);">
                  Real-time capacity, active reserve under management, and resolution velocity
                </div>
              </div>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Claims Officer</th>
                  <th>Markets</th>
                  <th>In Review</th>
                  <th>Awaiting Info</th>
                  <th>Closed (S/R)</th>
                  <th>Active Reserve (USD)</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let o of exp.teamWorkload">
                  <td><strong>{{ o.officerName }}</strong></td>
                  <td><span class="lob-pill">{{ o.primaryMarkets }}</span></td>
                  <td class="mono" style="font-weight: 700; color: #4338ca;">{{ o.activeUnderReviewCount }}</td>
                  <td class="mono" style="color: #b45309;">{{ o.awaitingInfoCount }}</td>
                  <td class="mono">{{ o.settledCount }} / {{ o.rejectedCount }}</td>
                  <td class="mono" style="font-weight: 700;">\${{ o.activeReserveManagedUsd | number:'1.0-0' }}</td>
                </tr>
              </tbody>
            </table>

            <!-- Line of Business Split -->
            <div style="padding: 1rem 1.25rem; border-top: 1px solid var(--border-color); background: #f8fafc;">
              <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">
                Exposure by Line of Business (Motor vs. Property)
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div *ngFor="let lob of exp.byClaimType" style="background: #fff; padding: 0.7rem 0.9rem; border-radius: 8px; border: 1px solid var(--border-color);">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>{{ lob.claimType }} Claims</strong>
                    <span class="lob-pill">{{ lob.openClaimsCount }} Open / {{ lob.totalClaimsCount }} Total</span>
                  </div>
                  <div class="mono" style="font-size: 1.1rem; font-weight: 800; margin-top: 0.3rem;">
                    \${{ lob.activeReserveUsd | number:'1.0-0' }} <span style="font-size: 0.74rem; font-weight: 500; color: var(--text-muted);">Active USD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Transactional Outbox -> Kafka / Event Stream Ticker -->
        <div class="panel-card">
          <div class="panel-header">
            <div>
              <div class="panel-title">Transactional Outbox & Kafka Domain Event Stream (<span class="mono">chubb.apac.claims.events</span>)</div>
              <div style="font-size: 0.76rem; color: var(--text-muted);">
                Every state transition writes atomically to SQLite OutboxMessages and streams asynchronously via OutboxRelayWorker
              </div>
            </div>
          </div>
          <div style="max-height: 290px; overflow-y: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Occurred (UTC)</th>
                  <th>Domain Event Type</th>
                  <th>Kafka Topic</th>
                  <th>Transport Status</th>
                  <th>Event Payload Snapshot</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let evt of exp.recentEventStream">
                  <td class="mono" style="font-size: 0.75rem; white-space: nowrap;">{{ evt.occurredAtUtc | date:'MMM d, HH:mm:ss' }}</td>
                  <td><span class="status-badge status-UnderReview mono">{{ evt.eventType }}</span></td>
                  <td class="mono" style="font-size: 0.75rem;">{{ evt.topic }}</td>
                  <td class="mono" style="font-size: 0.74rem; color: #047857;">{{ evt.transportMode }}</td>
                  <td class="mono" style="font-size: 0.72rem; color: var(--text-secondary); max-width: 480px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {{ evt.summaryJson }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ========================================================================= -->
      <!-- VIEW 2: UNIFIED CLAIMS WORKSPACE (CLAIMANT PORTAL & OFFICER WORKBENCH)    -->
      <!-- ========================================================================= -->
      <section *ngIf="persona.role === 'Claimant' || activeStaffTab() === 'workbench'">
        <!-- Quick Summary Strip for Staff Workbench -->
        <div class="kpi-grid" *ngIf="persona.role !== 'Claimant' && analytics() as exp">
          <div class="kpi-card highlight-navy">
            <div class="kpi-title">APAC Active Liability Exposure</div>
            <div class="kpi-value mono">\${{ exp.totalActiveLiabilityExposureUsd | number:'1.0-0' }}</div>
            <div class="kpi-sub">Normalized USD across SG, HK, AU, MY, TH, ID</div>
          </div>
          <div class="kpi-card" style="cursor: pointer;" (click)="applyQuickFilter('Submitted', 'UNASSIGNED')">
            <div class="kpi-title">Unassigned Triage Queue</div>
            <div class="kpi-value mono" style="color: #1d4ed8;">{{ exp.unassignedClaimsCount }}</div>
            <div class="kpi-sub">Click to filter unassigned FNOL claims</div>
          </div>
          <div class="kpi-card" style="cursor: pointer;" (click)="applyQuickFilter('', persona.id)">
            <div class="kpi-title">My Assigned Claims ({{ persona.name }})</div>
            <div class="kpi-value mono" style="color: #4338ca;">{{ myAssignedCount() }}</div>
            <div class="kpi-sub">Click to filter my personal workbench</div>
          </div>
          <div class="kpi-card" style="cursor: pointer;" (click)="applyQuickFilter('InfoRequested', '')">
            <div class="kpi-title">Awaiting Claimant Information</div>
            <div class="kpi-value mono" style="color: #b45309;">{{ exp.awaitingClaimantInfoCount }}</div>
            <div class="kpi-sub">Claims paused pending policyholder response</div>
          </div>
        </div>

        <div class="workspace-split">
          <!-- LEFT COLUMN: CLAIMS LIST & FILTERS -->
          <div class="panel-card">
            <div class="panel-header">
              <div>
                <div class="panel-title">
                  {{ persona.role === 'Claimant' ? 'My Reported Insurance Claims' : 'APAC Claims Triage & Officer Queue' }}
                </div>
                <div style="font-size: 0.76rem; color: var(--text-muted);">
                  Showing {{ claims().length }} claim(s) • Select a claim to inspect or progress
                </div>
              </div>
              <button
                *ngIf="persona.role !== 'Claimant' && (filterMarket() || filterType() || filterStatus() || filterOfficer() || filterSearch())"
                class="btn btn-outline"
                style="padding: 0.3rem 0.65rem; font-size: 0.75rem;"
                (click)="resetFilters()">
                Clear Filters
              </button>
            </div>

            <!-- Filter Bar (Staff Workbench) -->
            <div class="filter-bar" *ngIf="persona.role !== 'Claimant'">
              <input
                type="text"
                class="filter-input"
                placeholder="Search Claim #, Policy #, Claimant, Plate/Address..."
                [ngModel]="filterSearch()"
                (ngModelChange)="filterSearch.set($event); loadClaims()" />

              <select class="filter-select" [ngModel]="filterMarket()" (ngModelChange)="filterMarket.set($event); loadClaims()">
                <option value="">All 6 APAC Markets</option>
                <option *ngFor="let m of markets()" [value]="m.code">{{ m.code }} — {{ m.countryName }} ({{ m.currency }})</option>
              </select>

              <select class="filter-select" [ngModel]="filterType()" (ngModelChange)="filterType.set($event); loadClaims()">
                <option value="">All Lines (Motor & Property)</option>
                <option value="Motor">Motor</option>
                <option value="Property">Property</option>
              </select>

              <select class="filter-select" [ngModel]="filterStatus()" (ngModelChange)="filterStatus.set($event); loadClaims()">
                <option value="">All Statuses</option>
                <option value="Open">All Open (Active Exposure)</option>
                <option value="Submitted">Submitted (FNOL)</option>
                <option value="UnderReview">Under Review</option>
                <option value="InfoRequested">Info Requested</option>
                <option value="Settled">Settled</option>
                <option value="Rejected">Rejected</option>
              </select>

              <select class="filter-select" [ngModel]="filterOfficer()" (ngModelChange)="filterOfficer.set($event); loadClaims()">
                <option value="">All Officers / Unassigned</option>
                <option value="UNASSIGNED">Unassigned Only</option>
                <option *ngFor="let p of officerPersonas()" [value]="p.id">Assigned: {{ p.name }}</option>
              </select>
            </div>

            <!-- Claims Rows -->
            <div class="claims-list">
              <div
                *ngFor="let c of claims()"
                class="claim-row"
                [class.selected]="selectedClaim()?.id === c.id"
                (click)="selectClaim(c.id)">
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 0.3rem;">
                    <span class="market-pill">{{ c.market }}</span>
                    <span class="lob-pill">{{ c.claimType }}</span>
                    <strong class="mono" style="font-size: 0.9rem; color: #0f172a;">{{ c.claimNumber }}</strong>
                    <span style="font-size: 0.76rem; color: var(--text-muted);">• Policy {{ c.policyNumber }}</span>
                  </div>

                  <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">
                    {{ c.assetIdentifier }} — <span style="font-weight: 500; color: var(--text-secondary);">{{ c.incidentLocation }}</span>
                  </div>

                  <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.3rem; display: flex; gap: 0.9rem; flex-wrap: wrap;">
                    <span>Claimant: <strong>{{ c.claimantName }}</strong></span>
                    <span>Assigned: <strong>{{ c.assignedOfficerName || 'Unassigned (Triage)' }}</strong></span>
                    <span>Updated: {{ c.updatedAtUtc | date:'MMM d, HH:mm' }}</span>
                  </div>

                  <div
                    *ngIf="c.hasOpenInfoRequest"
                    style="margin-top: 0.45rem; display: inline-block; background: #fef3c7; color: #92400e; font-size: 0.74rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 5px;">
                    ⚠ Action Required: Additional Information Requested
                  </div>
                </div>

                <div style="text-align: right; min-width: 145px;">
                  <span class="status-badge" [ngClass]="'status-' + c.status">{{ formatStatus(c.status) }}</span>

                  <div class="mono" style="font-size: 0.92rem; font-weight: 800; margin-top: 0.45rem; color: #0f172a;">
                    {{ c.currency }} {{ (c.settledAmount ?? c.assessedReserve ?? c.estimatedLoss) | number:'1.0-0' }}
                  </div>
                  <div class="mono" style="font-size: 0.73rem; color: var(--text-muted);" *ngIf="c.activeReserveExposure > 0">
                    Reserve: \${{ c.activeReserveExposureUsd | number:'1.0-0' }} USD
                  </div>
                  <div class="mono" style="font-size: 0.73rem; color: #047857;" *ngIf="c.status === 'Settled'">
                    Settled (0 Active Exposure)
                  </div>
                </div>
              </div>

              <div *ngIf="claims().length === 0" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
                No claims match the current filter criteria.
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN: CLAIM DETAIL, LIFECYCLE STEPPER & ROLE ACTIONS -->
          <div class="panel-card" *ngIf="selectedClaim() as detail; else emptyDetailTpl">
            <div class="panel-header" style="background: #f8fafc;">
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="market-pill">{{ detail.market }} ({{ detail.countryName }})</span>
                  <span class="lob-pill">{{ detail.claimType }}</span>
                  <strong class="mono" style="font-size: 1.05rem;">{{ detail.claimNumber }}</strong>
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">
                  Policy <span class="mono">{{ detail.policyNumber }}</span> • Reported {{ detail.submittedAtUtc | date:'medium' }}
                </div>
              </div>
              <span class="status-badge" [ngClass]="'status-' + detail.status">{{ formatStatus(detail.status) }}</span>
            </div>

            <div style="padding: 1.25rem;">
              <!-- Visual Lifecycle Stepper -->
              <div class="stepper">
                <div class="step-item done">
                  <span class="step-dot">✓</span>
                  <span>1. FNOL Submitted</span>
                </div>
                <div
                  class="step-item"
                  [class.active]="detail.status === 'UnderReview'"
                  [class.done]="detail.status === 'Settled' || detail.status === 'Rejected'">
                  <span class="step-dot">2</span>
                  <span>2. Officer Assessment</span>
                </div>
                <div
                  class="step-item"
                  [class.active]="detail.status === 'InfoRequested'"
                  [class.done]="detail.informationRequests.length > 0 && detail.status !== 'InfoRequested'">
                  <span class="step-dot">3</span>
                  <span>3. Info Verification</span>
                </div>
                <div
                  class="step-item"
                  [class.done]="detail.status === 'Settled'"
                  [class.active]="detail.status === 'Rejected'">
                  <span class="step-dot">4</span>
                  <span>4. {{ detail.status === 'Rejected' ? 'Rejected' : 'Settlement Decision' }}</span>
                </div>
              </div>

              <!-- Financial & Reserve Exposure Strip -->
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1rem;">
                <div style="background: #f8fafc; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color);">
                  <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Claimant Estimated Loss</div>
                  <div class="mono" style="font-size: 1rem; font-weight: 700; margin-top: 0.2rem;">
                    {{ detail.currency }} {{ detail.estimatedLoss | number:'1.2-2' }}
                  </div>
                </div>

                <div style="background: #f8fafc; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color);">
                  <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Officer Assessed Reserve</div>
                  <div class="mono" style="font-size: 1rem; font-weight: 700; color: #4338ca; margin-top: 0.2rem;">
                    {{ detail.assessedReserve ? (detail.currency + ' ' + (detail.assessedReserve | number:'1.2-2')) : 'Pending Assessment' }}
                  </div>
                </div>

                <div style="background: #0f172a; color: #fff; padding: 0.75rem; border-radius: 8px;">
                  <div style="font-size: 0.7rem; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Active Liability Exposure</div>
                  <div class="mono" style="font-size: 1rem; font-weight: 800; color: #34d399; margin-top: 0.2rem;">
                    \${{ detail.activeReserveExposureUsd | number:'1.2-2' }} USD
                  </div>
                  <div class="mono" style="font-size: 0.7rem; color: #cbd5e1;">
                    ({{ detail.currency }} {{ detail.activeReserveExposure | number:'1.0-0' }} &#64; FX {{ detail.fxRateToUsd }})
                  </div>
                </div>
              </div>

              <!-- Final Decision Banner (If Settled or Rejected) -->
              <div
                *ngIf="detail.status === 'Settled' || detail.status === 'Rejected'"
                style="padding: 0.95rem 1.1rem; border-radius: 8px; margin-bottom: 1rem;"
                [style.background]="detail.status === 'Settled' ? '#ecfdf5' : '#fef2f2'"
                [style.border]="detail.status === 'Settled' ? '1px solid #10b981' : '1px solid #ef4444'">
                <div style="font-weight: 800; font-size: 0.9rem;" [style.color]="detail.status === 'Settled' ? '#047857' : '#b91c1c'">
                  {{ detail.status === 'Settled'
                    ? '✓ CLAIM APPROVED & SETTLED — Payout: ' + detail.currency + ' ' + (detail.settledAmount | number:'1.2-2') + ' ($' + (detail.realizedPayoutUsd | number:'1.2-2') + ' USD)'
                    : '✕ CLAIM REJECTED — Reserve Released ($' + (detail.releasedReserveUsd | number:'1.2-2') + ' USD)' }}
                </div>
                <div style="font-size: 0.82rem; margin-top: 0.3rem; color: var(--text-primary);">
                  <strong>Decision Rationale:</strong> {{ detail.decisionNotes }}
                </div>
              </div>

              <!-- Incident Details Card -->
              <div style="background: #fff; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.9rem 1rem; margin-bottom: 1rem; font-size: 0.83rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.6rem;">
                  <div><span style="color: var(--text-muted);">Claimant:</span> <strong>{{ detail.claimantName }}</strong> ({{ detail.claimantPhone }})</div>
                  <div><span style="color: var(--text-muted);">Insured Asset:</span> <strong>{{ detail.assetIdentifier }}</strong></div>
                  <div><span style="color: var(--text-muted);">Incident Date:</span> {{ detail.incidentDateUtc | date:'mediumDate' }}</div>
                  <div><span style="color: var(--text-muted);">Assigned Adjuster:</span> <strong>{{ detail.assignedOfficerName || 'Unassigned' }}</strong></div>
                </div>
                <div style="border-top: 1px solid var(--border-color); padding-top: 0.55rem;">
                  <div style="color: var(--text-muted); font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">Incident Location & Description</div>
                  <div style="margin-top: 0.2rem;"><strong>{{ detail.incidentLocation }}</strong> — {{ detail.incidentDescription }}</div>
                </div>
              </div>

              <!-- ================================================================= -->
              <!-- CLAIMANT ACTION: RESPOND TO INFORMATION REQUEST                   -->
              <!-- ================================================================= -->
              <div
                *ngIf="detail.status === 'InfoRequested' && persona.role === 'Claimant'"
                class="action-box alert-warning">
                <div style="font-weight: 800; font-size: 0.9rem; color: #92400e; margin-bottom: 0.35rem;">
                  ⚠ Action Required: Claims Officer Requested Additional Information
                </div>
                <div *ngIf="openInfoRequest(detail) as req" style="font-size: 0.84rem; margin-bottom: 0.75rem; background: #fff; padding: 0.65rem 0.85rem; border-radius: 6px; border: 1px solid #fcd34d;">
                  <div><strong>{{ req.requestedByOfficerName }} asked:</strong></div>
                  <div style="margin-top: 0.2rem;">"{{ req.question }}"</div>
                </div>

                <div class="form-group">
                  <label class="form-label">Your Response / Clarification</label>
                  <textarea
                    rows="2"
                    class="form-control"
                    placeholder="Provide the requested details for the claims officer..."
                    [(ngModel)]="claimantResponseText"></textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">Supporting Document / Evidence Reference (Optional)</label>
                  <input
                    type="text"
                    class="form-control"
                    placeholder="e.g. MCST_Plumber_Report_2026.pdf or Workshop_Quote_882.pdf"
                    [(ngModel)]="claimantDocRef" />
                </div>
                <button class="btn btn-warning" [disabled]="!claimantResponseText.trim()" (click)="onSubmitClaimantResponse(detail.id)">
                  Submit Response & Resume Review
                </button>
              </div>

              <!-- ================================================================= -->
              <!-- CLAIMS OFFICER WORKBENCH CONTROLS                                 -->
              <!-- ================================================================= -->
              <div
                *ngIf="persona.role !== 'Claimant' && detail.status !== 'Settled' && detail.status !== 'Rejected'"
                class="action-box"
                style="background: #f1f5f9; border-color: #cbd5e1;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
                  <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a;">
                    Claims Officer Action Console ({{ persona.name }})
                  </div>
                  <button
                    *ngIf="detail.status === 'Submitted' || detail.assignedOfficerId !== persona.id"
                    class="btn btn-navy"
                    (click)="onPickUpClaim(detail.id)">
                    ✋ Pick Up & Assign to Me
                  </button>
                </div>

                <!-- 1. Update Reserve & Add Internal Assessment Note -->
                <div style="background: #fff; padding: 0.85rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 0.75rem;">
                  <div style="font-size: 0.78rem; font-weight: 700; color: #4338ca; margin-bottom: 0.5rem;">
                    1. Reserve Assessment & Internal Adjuster Note (Hidden from Claimant)
                  </div>
                  <div class="form-grid">
                    <div class="form-group" style="margin-bottom: 0;">
                      <label class="form-label">Assessed Reserve ({{ detail.currency }})</label>
                      <input type="number" class="form-control mono" [(ngModel)]="officerReserveInput" />
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                      <label class="form-label">Internal Assessment Note</label>
                      <input
                        type="text"
                        class="form-control"
                        placeholder="Add confidential adjuster note..."
                        [(ngModel)]="officerNoteInput" />
                    </div>
                  </div>
                  <div style="margin-top: 0.6rem; text-align: right;">
                    <button class="btn btn-primary" (click)="onUpdateAssessment(detail.id)">
                      Save Reserve & Assessment Note
                    </button>
                  </div>
                </div>

                <!-- 2. Request Additional Information from Claimant -->
                <div
                  *ngIf="detail.status === 'UnderReview' || detail.status === 'Submitted'"
                  style="background: #fff; padding: 0.85rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 0.75rem;">
                  <div style="font-size: 0.78rem; font-weight: 700; color: #b45309; margin-bottom: 0.5rem;">
                    2. Request Additional Information from Claimant
                  </div>
                  <div style="display: flex; gap: 0.5rem;">
                    <input
                      type="text"
                      class="form-control"
                      style="flex: 1;"
                      placeholder="Specify documents or clarification required from policyholder..."
                      [(ngModel)]="officerQuestionInput" />
                    <button
                      class="btn btn-warning"
                      [disabled]="!officerQuestionInput.trim()"
                      (click)="onRequestInfo(detail.id)">
                      Request Info
                    </button>
                  </div>
                </div>

                <!-- 3. Progress to Settlement or Rejection -->
                <div
                  *ngIf="detail.status === 'UnderReview'"
                  style="background: #fff; padding: 0.85rem; border-radius: 8px; border: 1px solid var(--border-color);">
                  <div style="font-size: 0.78rem; font-weight: 700; color: #047857; margin-bottom: 0.5rem;">
                    3. Final Claim Determination (Settle or Reject)
                  </div>
                  <div class="form-grid">
                    <div class="form-group" style="margin-bottom: 0;">
                      <label class="form-label">Approved Settlement Payout ({{ detail.currency }})</label>
                      <input type="number" class="form-control mono" [(ngModel)]="settlementAmountInput" />
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                      <label class="form-label">Decision / Rejection Rationale</label>
                      <input
                        type="text"
                        class="form-control"
                        placeholder="Enter settlement terms or policy exclusion reason..."
                        [(ngModel)]="decisionRationaleInput" />
                    </div>
                  </div>
                  <div style="margin-top: 0.65rem; display: flex; justify-content: flex-end; gap: 0.6rem;">
                    <button
                      class="btn btn-danger"
                      [disabled]="!decisionRationaleInput.trim()"
                      (click)="onRejectClaim(detail.id)">
                      ✕ Reject Claim (Release Reserve)
                    </button>
                    <button
                      class="btn btn-success"
                      [disabled]="!decisionRationaleInput.trim() || settlementAmountInput <= 0"
                      (click)="onSettleClaim(detail.id)">
                      ✓ Approve & Settle Claim
                    </button>
                  </div>
                </div>
              </div>

              <!-- Information Request History -->
              <div *ngIf="detail.informationRequests.length > 0" style="margin-top: 1.1rem;">
                <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.45rem;">
                  Information Request & Verification Log ({{ detail.informationRequests.length }})
                </div>
                <div
                  *ngFor="let ir of detail.informationRequests"
                  style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 0.75rem 0.9rem; margin-bottom: 0.5rem; font-size: 0.81rem;">
                  <div>
                    <strong>Q ({{ ir.requestedByOfficerName }} • {{ ir.requestedAtUtc | date:'MMM d, HH:mm' }}):</strong>
                    {{ ir.question }}
                  </div>
                  <div *ngIf="ir.isResolved" style="margin-top: 0.4rem; color: #065f46; background: #ecfdf5; padding: 0.45rem 0.65rem; border-radius: 6px;">
                    <strong>✓ Claimant Response ({{ ir.respondedAtUtc | date:'MMM d, HH:mm' }}):</strong> {{ ir.claimantResponse }}
                    <span *ngIf="ir.supportingDocumentRef" class="mono" style="display: block; font-size: 0.74rem; margin-top: 0.15rem;">
                      Attachment: {{ ir.supportingDocumentRef }}
                    </span>
                  </div>
                  <div *ngIf="!ir.isResolved" style="margin-top: 0.35rem; color: #b45309; font-weight: 600;">
                    ⏳ Awaiting Claimant Response...
                  </div>
                </div>
              </div>

              <!-- Internal Adjuster Notes (Visible ONLY to Staff Personas) -->
              <div *ngIf="persona.role !== 'Claimant' && detail.notes.length > 0" style="margin-top: 1.1rem;">
                <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: #4338ca; margin-bottom: 0.45rem;">
                  🔒 Confidential Internal Adjuster Notes ({{ detail.notes.length }})
                </div>
                <div
                  *ngFor="let n of detail.notes"
                  style="background: #eef2ff; border-left: 3px solid #4f46e5; padding: 0.6rem 0.85rem; border-radius: 0 6px 6px 0; margin-bottom: 0.45rem; font-size: 0.8rem;">
                  <div style="font-weight: 700; color: #312e81;">
                    {{ n.authorName }} <span style="font-weight: 400; color: #64748b;">• {{ n.createdAtUtc | date:'MMM d, HH:mm' }}</span>
                  </div>
                  <div style="margin-top: 0.15rem;">{{ n.content }}</div>
                </div>
              </div>

              <!-- Chronological Audit Trail -->
              <div style="margin-top: 1.15rem;">
                <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.45rem;">
                  Immutable Claim Audit Trail ({{ detail.auditTrail.length }})
                </div>
                <div class="timeline">
                  <div *ngFor="let a of detail.auditTrail" class="timeline-item">
                    <div style="display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-muted);">
                      <strong class="mono" style="color: var(--text-primary);">{{ a.action }}</strong>
                      <span>{{ a.actorName }} ({{ a.actorRole }}) • {{ a.occurredAtUtc | date:'MMM d, HH:mm:ss' }}</span>
                    </div>
                    <div style="margin-top: 0.2rem; color: var(--text-secondary);">{{ a.description }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ng-template #emptyDetailTpl>
            <div class="panel-card" style="padding: 3rem; text-align: center; color: var(--text-muted);">
              Select a claim from the list to view its lifecycle, reserve exposure, and actions.
            </div>
          </ng-template>
        </div>
      </section>
    </main>

    <!-- ========================================================================= -->
    <!-- MODAL: REPORT NEW INCIDENT (FNOL)                                         -->
    <!-- ========================================================================= -->
    <div class="modal-backdrop" *ngIf="showFnolModal()">
      <div class="modal-card">
        <div class="panel-header" style="background: var(--bg-navy); color: #fff;">
          <div>
            <div class="panel-title" style="color: #fff;">Report First Notice of Loss (FNOL)</div>
            <div style="font-size: 0.76rem; color: #94a3b8;">
              Submit a Motor or Property claim across Chubb APAC markets
            </div>
          </div>
          <button class="btn btn-outline" style="padding: 0.25rem 0.6rem;" (click)="showFnolModal.set(false)">✕</button>
        </div>

        <div style="padding: 1.25rem;">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">APAC Market</label>
              <select class="form-control" [(ngModel)]="fnolForm.market" (ngModelChange)="onFnolMarketChange($event)">
                <option *ngFor="let m of markets()" [value]="m.code">
                  {{ m.code }} — {{ m.countryName }} ({{ m.currency }})
                </option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Line of Business (Claim Type)</label>
              <select class="form-control" [(ngModel)]="fnolForm.claimType">
                <option value="Motor">Motor Insurance</option>
                <option value="Property">Property Insurance</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Policy Number</label>
              <input type="text" class="form-control mono" [(ngModel)]="fnolForm.policyNumber" />
            </div>

            <div class="form-group">
              <label class="form-label">
                {{ fnolForm.claimType === 'Motor' ? 'Vehicle Registration Plate & Model' : 'Insured Property Address / Unit' }}
              </label>
              <input
                type="text"
                class="form-control"
                [placeholder]="fnolForm.claimType === 'Motor' ? 'e.g. SGP 4819 K (Toyota Camry)' : 'e.g. 18 Marina Blvd #24-08'"
                [(ngModel)]="fnolForm.assetIdentifier" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Incident Location</label>
              <input
                type="text"
                class="form-control"
                placeholder="Expressway / Street / City"
                [(ngModel)]="fnolForm.incidentLocation" />
            </div>

            <div class="form-group">
              <label class="form-label">Estimated Loss Amount ({{ selectedMarketCurrency() }})</label>
              <input type="number" class="form-control mono" [(ngModel)]="fnolForm.estimatedLoss" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Incident Description & Damage Summary</label>
            <textarea
              rows="3"
              class="form-control"
              placeholder="Describe how the incident occurred and visible damage..."
              [(ngModel)]="fnolForm.incidentDescription"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.65rem; margin-top: 1rem;">
            <button class="btn btn-outline" (click)="showFnolModal.set(false)">Cancel</button>
            <button
              class="btn btn-primary"
              [disabled]="!fnolForm.policyNumber || !fnolForm.incidentLocation || !fnolForm.incidentDescription || fnolForm.estimatedLoss <= 0"
              (click)="onSubmitFnol()">
              Submit Claim Now
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AppComponent implements OnInit {
  readonly api = inject(ClaimsApiService);

  readonly markets = signal<MarketMetadata[]>([]);
  readonly personas = signal<Persona[]>([]);
  readonly activePersona = signal<Persona | null>(null);
  readonly activeStaffTab = signal<'workbench' | 'analytics'>('workbench');

  readonly claims = signal<ClaimSummary[]>([]);
  readonly selectedClaim = signal<ClaimDetail | null>(null);
  readonly analytics = signal<ExposureAnalytics | null>(null);
  readonly toastMessage = signal<string | null>(null);

  // Filters
  readonly filterMarket = signal<string>('');
  readonly filterType = signal<string>('');
  readonly filterStatus = signal<string>('');
  readonly filterOfficer = signal<string>('');
  readonly filterSearch = signal<string>('');

  // Form inputs for Officer & Claimant actions
  claimantResponseText = '';
  claimantDocRef = '';
  officerReserveInput: number | null = null;
  officerNoteInput = '';
  officerQuestionInput = '';
  settlementAmountInput = 0;
  decisionRationaleInput = '';

  // FNOL Modal
  readonly showFnolModal = signal<boolean>(false);
  fnolForm = {
    market: 'SG',
    claimType: 'Motor',
    policyNumber: 'SG-MTR-994120',
    assetIdentifier: 'SBA 9912 E (Honda CR-V)',
    incidentLocation: 'Ayer Rajah Expressway (AYE), Singapore',
    incidentDescription: 'Multi-lane rear-end collision during peak hour traffic; rear tailgate and bumper dented.',
    estimatedLoss: 9500
  };

  readonly claimantPersonas = computed(() => this.personas().filter(p => p.role === 'Claimant'));
  readonly staffPersonas = computed(() => this.personas().filter(p => p.role !== 'Claimant'));
  readonly officerPersonas = computed(() => this.personas().filter(p => p.role === 'ClaimsOfficer'));

  readonly myAssignedCount = computed(() => {
    const p = this.activePersona();
    if (!p) return 0;
    return this.claims().filter(c => c.assignedOfficerId === p.id && c.status !== 'Settled' && c.status !== 'Rejected').length;
  });

  readonly selectedMarketCurrency = computed(() => {
    const found = this.markets().find(m => m.code === this.fnolForm.market);
    return found ? found.currency : 'SGD';
  });

  ngOnInit(): void {
    this.api.getBootstrapMetadata().subscribe(meta => {
      this.markets.set(meta.markets);
      this.personas.set(meta.personas);

      // Default to Sarah Jenkins (Senior Claims Officer) or first persona
      const defaultPersona = meta.personas.find(p => p.id === 'off-sarah') || meta.personas[0];
      this.activePersona.set(defaultPersona);
      this.refreshAll();
    });

    this.api.connectSignalR(() => {
      this.loadClaims(false);
      this.loadAnalytics();
      const sel = this.selectedClaim();
      if (sel) {
        this.selectClaim(sel.id, false);
      }
    });
  }

  onSelectPersona(personaId: string): void {
    const found = this.personas().find(p => p.id === personaId);
    if (!found) return;
    this.activePersona.set(found);

    if (found.role === 'ClaimsManager') {
      this.activeStaffTab.set('analytics');
    } else {
      this.activeStaffTab.set('workbench');
    }

    this.resetFilters(false);
    this.refreshAll();
  }

  switchToAnalyticsTab(): void {
    this.activeStaffTab.set('analytics');
    this.loadAnalytics();
  }

  refreshAll(): void {
    this.loadClaims(true);
    this.loadAnalytics();
  }

  loadClaims(autoSelectFirst = false): void {
    const persona = this.activePersona();
    if (!persona) return;

    const filters =
      persona.role === 'Claimant'
        ? { claimantId: persona.id }
        : {
            market: this.filterMarket() || undefined,
            claimType: this.filterType() || undefined,
            status: this.filterStatus() || undefined,
            assignedOfficerId: this.filterOfficer() || undefined,
            search: this.filterSearch() || undefined
          };

    this.api.getClaims(persona, filters).subscribe(list => {
      this.claims.set(list);
      const currentSelected = this.selectedClaim();
      if (autoSelectFirst || !currentSelected || !list.some(c => c.id === currentSelected.id)) {
        if (list.length > 0) {
          this.selectClaim(list[0].id);
        } else {
          this.selectedClaim.set(null);
        }
      } else {
        this.selectClaim(currentSelected.id, false);
      }
    });
  }

  loadAnalytics(): void {
    this.api.getExposureAnalytics().subscribe(exp => {
      this.analytics.set(exp);
    });
  }

  selectClaim(id: string, resetInputs = true): void {
    const persona = this.activePersona();
    this.api.getClaimById(id, persona).subscribe(detail => {
      this.selectedClaim.set(detail);
      if (resetInputs) {
        this.officerReserveInput = detail.assessedReserve ?? detail.estimatedLoss;
        this.settlementAmountInput = detail.assessedReserve ?? detail.estimatedLoss;
        this.officerNoteInput = '';
        this.officerQuestionInput = '';
        this.decisionRationaleInput = '';
        this.claimantResponseText = '';
        this.claimantDocRef = '';
      }
    });
  }

  applyQuickFilter(status: string, officerId: string): void {
    this.filterStatus.set(status);
    this.filterOfficer.set(officerId);
    this.loadClaims(true);
  }

  resetFilters(reload = true): void {
    this.filterMarket.set('');
    this.filterType.set('');
    this.filterStatus.set('');
    this.filterOfficer.set('');
    this.filterSearch.set('');
    if (reload) this.loadClaims(true);
  }

  openFnolModal(): void {
    const p = this.activePersona();
    const market = p?.market && p.market.length === 2 ? p.market : 'SG';
    this.fnolForm.market = market;
    this.onFnolMarketChange(market);
    this.showFnolModal.set(true);
  }

  onFnolMarketChange(market: string): void {
    this.fnolForm.policyNumber = `${market}-${this.fnolForm.claimType === 'Motor' ? 'MTR' : 'PRP'}-${Math.floor(100000 + Math.random() * 899999)}`;
  }

  onSubmitFnol(): void {
    const persona = this.activePersona();
    this.api
      .submitClaim(persona, {
        policyNumber: this.fnolForm.policyNumber,
        market: this.fnolForm.market,
        claimType: this.fnolForm.claimType,
        incidentDateUtc: new Date().toISOString(),
        incidentLocation: this.fnolForm.incidentLocation,
        incidentDescription: this.fnolForm.incidentDescription,
        assetIdentifier: this.fnolForm.assetIdentifier,
        estimatedLoss: Number(this.fnolForm.estimatedLoss)
      })
      .subscribe(created => {
        this.showFnolModal.set(false);
        this.showToast(`Claim ${created.claimNumber} submitted! Outbox event queued for Kafka & Liability Exposure updated.`);
        this.loadClaims(false);
        this.loadAnalytics();
        this.selectClaim(created.id);
      });
  }

  onPickUpClaim(claimId: string): void {
    const persona = this.activePersona();
    this.api.pickUpClaim(claimId, persona).subscribe(updated => {
      this.selectedClaim.set(updated);
      this.showToast(`Claim ${updated.claimNumber} assigned to ${persona?.name} and moved to Under Review.`);
      this.loadClaims(false);
      this.loadAnalytics();
    });
  }

  onUpdateAssessment(claimId: string): void {
    const persona = this.activePersona();
    this.api
      .updateAssessment(claimId, persona, {
        assessedReserve: this.officerReserveInput ? Number(this.officerReserveInput) : null,
        internalNote: this.officerNoteInput || null
      })
      .subscribe(updated => {
        this.selectedClaim.set(updated);
        this.officerNoteInput = '';
        this.showToast(`Assessment updated for ${updated.claimNumber}. Active Reserve Exposure recalculated.`);
        this.loadClaims(false);
        this.loadAnalytics();
      });
  }

  onRequestInfo(claimId: string): void {
    const persona = this.activePersona();
    this.api.requestInfo(claimId, persona, this.officerQuestionInput).subscribe(updated => {
      this.selectedClaim.set(updated);
      this.officerQuestionInput = '';
      this.showToast(`Information request sent to claimant ${updated.claimantName}. Status -> InfoRequested.`);
      this.loadClaims(false);
      this.loadAnalytics();
    });
  }

  onSubmitClaimantResponse(claimId: string): void {
    const persona = this.activePersona();
    this.api
      .respondToInfo(claimId, persona, {
        response: this.claimantResponseText,
        supportingDocumentRef: this.claimantDocRef || undefined
      })
      .subscribe(updated => {
        this.selectedClaim.set(updated);
        this.claimantResponseText = '';
        this.claimantDocRef = '';
        this.showToast(`Response submitted! Claim ${updated.claimNumber} returned to Under Review.`);
        this.loadClaims(false);
        this.loadAnalytics();
      });
  }

  onSettleClaim(claimId: string): void {
    const persona = this.activePersona();
    this.api
      .settleClaim(claimId, persona, {
        settledAmount: Number(this.settlementAmountInput),
        decisionNotes: this.decisionRationaleInput
      })
      .subscribe(updated => {
        this.selectedClaim.set(updated);
        this.showToast(`Claim ${updated.claimNumber} SETTLED for ${updated.currency} ${updated.settledAmount?.toLocaleString()}. Active reserve cleared to 0.`);
        this.loadClaims(false);
        this.loadAnalytics();
      });
  }

  onRejectClaim(claimId: string): void {
    const persona = this.activePersona();
    this.api.rejectClaim(claimId, persona, this.decisionRationaleInput).subscribe(updated => {
      this.selectedClaim.set(updated);
      this.showToast(`Claim ${updated.claimNumber} REJECTED. Active reserve exposure released.`);
      this.loadClaims(false);
      this.loadAnalytics();
    });
  }

  openInfoRequest(detail: ClaimDetail) {
    return detail.informationRequests.find(r => !r.isResolved) || detail.informationRequests[0];
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'UnderReview': return 'Under Review';
      case 'InfoRequested': return 'Info Requested';
      default: return status;
    }
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set(null);
      }
    }, 6000);
  }
}
