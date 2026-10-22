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
    <!-- TOP BAR: Clean 2-Button Role Switcher (User 1: Claimant vs User 2: Claims Officer) -->
    <header class="topbar">
      <div class="brand-group">
        <span class="chubb-wordmark">CHUBB</span>
        <div>
          <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">APAC Claims Platform</div>
          <div class="platform-subtitle">Motor & Property Claims</div>
        </div>
      </div>

      <!-- Simple 2-Button Toggle -->
      <div style="display: flex; align-items: center; gap: 0.6rem;">
        <button
          class="btn"
          [ngClass]="activeRole() === 'Claimant' ? 'btn-primary' : 'btn-outline'"
          style="padding: 0.45rem 1rem;"
          (click)="switchRole('Claimant')">
            User 1: Claimant ({{ claimantUser()?.name || 'Tan Wei Ming' }})
        </button>

        <button
          class="btn"
          [ngClass]="activeRole() === 'ClaimsOfficer' ? 'btn-primary' : 'btn-outline'"
          style="padding: 0.45rem 1rem;"
          (click)="switchRole('ClaimsOfficer')">
            User 2: Claims Officer ({{ officerUser()?.name || 'Sarah Jenkins' }})
        </button>
      </div>
    </header>

    <main class="container">
      <!-- API Connection Warning if Backend is not running -->
      <div
        *ngIf="api.apiError()"
        style="background: #fef2f2; border: 1px solid #ef4444; color: #b91c1c; padding: 1rem 1.25rem; border-radius: 8px; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>Backend API Connection Needed:</strong> {{ api.apiError() }}
        </div>
        <button class="btn btn-danger" (click)="ngOnInit()">Retry Connection</button>
      </div>

      <!-- Toast Notification -->
      <div
        *ngIf="toastMessage()"
        style="background: #0f172a; color: #fff; padding: 0.75rem 1.15rem; border-radius: 8px; margin-bottom: 1.15rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; border-left: 4px solid #10b981;">
        <span>{{ toastMessage() }}</span>
        <button class="btn btn-outline" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;" (click)="toastMessage.set(null)">OK</button>
      </div>

      <!-- =================================================================== -->
      <!-- USER 1 VIEW: CLAIMANT (CUSTOMER)                                    -->
      <!-- - Submit a new insurance claim                                      -->
      <!-- - Track claim status                                                -->
      <!-- - Provide additional information when requested                     -->
      <!-- - View whether their claim was approved or rejected                 -->
      <!-- =================================================================== -->
      <section *ngIf="activeRole() === 'Claimant'">
        <div class="persona-context-bar">
          <div>
            <h2 style="font-size: 1.1rem; font-weight: 700;">Welcome, {{ activePersona()?.name || 'Tan Wei Ming' }} (Customer Portal)</h2>
            <p style="font-size: 0.82rem; color: var(--text-muted);">
              Submit a new insurance claim, track your claim status, respond to officer requests, and view decisions.
            </p>
          </div>
          <button class="btn btn-primary" (click)="openFnolModal()">
            + Submit New Insurance Claim
          </button>
        </div>

        <div class="workspace-split">
          <!-- LEFT: Claimant's Claims List -->
          <div class="panel-card">
            <div class="panel-header">
              <div class="panel-title">My Insurance Claims ({{ claims().length }})</div>
            </div>

            <div class="claims-list">
              <div
                *ngFor="let c of claims()"
                class="claim-row"
                [class.selected]="selectedClaim()?.id === c.id"
                (click)="selectClaim(c.id)">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.45rem; margin-bottom: 0.25rem;">
                    <span class="market-pill">{{ c.market }}</span>
                    <span class="lob-pill">{{ c.claimType }}</span>
                    <strong class="mono">{{ c.claimNumber }}</strong>
                  </div>
                  <div style="font-size: 0.85rem; font-weight: 600;">{{ c.assetIdentifier }}</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted);">{{ c.incidentLocation }}</div>

                  <div
                    *ngIf="c.status === 'InfoRequested'"
                    style="margin-top: 0.4rem; display: inline-block; background: #fef3c7; color: #92400e; font-size: 0.74rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 4px;">
                    ⚠ Action Needed: Officer requested additional info
                  </div>
                </div>

                <div style="text-align: right;">
                  <span class="status-badge" [ngClass]="'status-' + c.status">{{ formatStatus(c.status) }}</span>
                  <div class="mono" style="font-weight: 700; margin-top: 0.4rem;">
                    {{ c.currency }} {{ (c.settledAmount ?? c.estimatedLoss) | number:'1.0-0' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT: Claimant Claim Status & Actions -->
          <div class="panel-card" *ngIf="selectedClaim() as detail">
            <div class="panel-header">
              <div>
                <strong class="mono" style="font-size: 1.05rem;">{{ detail.claimNumber }}</strong>
                <span style="color: var(--text-muted); font-size: 0.82rem; margin-left: 0.5rem;">• Policy {{ detail.policyNumber }}</span>
              </div>
              <span class="status-badge" [ngClass]="'status-' + detail.status">{{ formatStatus(detail.status) }}</span>
            </div>

            <div style="padding: 1.25rem;">
              <!-- 1. Track Claim Status (Stepper) -->
              <div class="stepper">
                <div class="step-item done">
                  <span class="step-dot">✓</span>
                  <span>Submitted</span>
                </div>
                <div class="step-item" [class.active]="detail.status === 'UnderReview'" [class.done]="detail.status === 'Settled' || detail.status === 'Rejected'">
                  <span class="step-dot">2</span>
                  <span>Under Review</span>
                </div>
                <div class="step-item" [class.active]="detail.status === 'InfoRequested'">
                  <span class="step-dot">3</span>
                  <span>Info Requested</span>
                </div>
                <div class="step-item" [class.done]="detail.status === 'Settled'" [class.active]="detail.status === 'Rejected'">
                  <span class="step-dot">4</span>
                  <span>{{ detail.status === 'Settled' ? 'Approved' : (detail.status === 'Rejected' ? 'Rejected' : 'Decision') }}</span>
                </div>
              </div>

              <!-- 2. View Whether Claim Was Approved or Rejected -->
              <div
                *ngIf="detail.status === 'Settled' || detail.status === 'Rejected'"
                style="padding: 1rem; border-radius: 8px; margin-bottom: 1rem;"
                [style.background]="detail.status === 'Settled' ? '#ecfdf5' : '#fef2f2'"
                [style.border]="detail.status === 'Settled' ? '1px solid #10b981' : '1px solid #ef4444'">
                <div style="font-weight: 800; font-size: 0.95rem;" [style.color]="detail.status === 'Settled' ? '#047857' : '#b91c1c'">
                  {{ detail.status === 'Settled'
                    ? '✓ CLAIM APPROVED — Approved Payout: ' + detail.currency + ' ' + (detail.settledAmount | number:'1.2-2')
                    : '✕ CLAIM REJECTED' }}
                </div>
                <div style="font-size: 0.84rem; margin-top: 0.3rem;">
                  <strong>Decision Notes:</strong> {{ detail.decisionNotes }}
                </div>
              </div>

              <!-- 3. Provide Additional Information When Requested -->
              <div *ngIf="detail.status === 'InfoRequested'" class="action-box alert-warning" style="margin-bottom: 1rem; margin-top: 0;">
                <div style="font-weight: 700; color: #92400e; margin-bottom: 0.4rem;">
                  ⚠ Officer Request for Information
                </div>
                <div *ngIf="openInfoRequest(detail) as req" style="background: #fff; padding: 0.7rem; border-radius: 6px; border: 1px solid #fcd34d; margin-bottom: 0.75rem; font-size: 0.85rem;">
                  <strong>{{ req.requestedByOfficerName }} asked:</strong> "{{ req.question }}"
                </div>
                <div class="form-group">
                  <label class="form-label">Your Reply</label>
                  <textarea rows="2" class="form-control" placeholder="Type your response here..." [(ngModel)]="claimantResponseText"></textarea>
                </div>
                <button class="btn btn-warning" [disabled]="!claimantResponseText.trim()" (click)="onSubmitClaimantResponse(detail.id)">
                  Send Additional Information
                </button>
              </div>

              <!-- Claim Summary Info -->
              <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.84rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-bottom: 0.75rem;">
                  <div><span style="color: var(--text-muted);">Market / Type:</span> <strong>{{ detail.countryName }} ({{ detail.claimType }})</strong></div>
                  <div><span style="color: var(--text-muted);">Claimed Amount:</span> <strong class="mono">{{ detail.currency }} {{ detail.estimatedLoss | number:'1.2-2' }}</strong></div>
                  <div><span style="color: var(--text-muted);">Asset:</span> <strong>{{ detail.assetIdentifier }}</strong></div>
                  <div><span style="color: var(--text-muted);">Assigned Officer:</span> <strong>{{ detail.assignedOfficerName || 'Pending Assignment' }}</strong></div>
                </div>
                <div>
                  <div style="color: var(--text-muted); font-size: 0.75rem; font-weight: 600;">INCIDENT DESCRIPTION</div>
                  <div style="margin-top: 0.2rem;">{{ detail.incidentLocation }} — {{ detail.incidentDescription }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- =================================================================== -->
      <!-- USER 2 VIEW: CLAIMS OFFICER (INSURANCE STAFF)                       -->
      <!-- - See outstanding claims and workload                               -->
      <!-- - Monitor pending financial liability                               -->
      <!-- - View incoming insurance claims                                    -->
      <!-- - Assign or pick up a claim                                         -->
      <!-- - Review claim details                                              -->
      <!-- - Approve or reject a claim                                         -->
      <!-- =================================================================== -->
      <section *ngIf="activeRole() === 'ClaimsOfficer'">
        <!-- Top Summary Bar: Workload & Pending Financial Liability -->
        <div class="kpi-grid" *ngIf="analytics() as exp">
          <div class="kpi-card highlight-navy">
            <div class="kpi-title">Pending Financial Liability (USD)</div>
            <div class="kpi-value mono">\${{ exp.totalActiveLiabilityExposureUsd | number:'1.0-0' }}</div>
            <div class="kpi-sub">Active reserve exposure across {{ exp.openClaimsCount }} open claims</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-title">Incoming Unassigned Claims</div>
            <div class="kpi-value mono" style="color: #1d4ed8;">{{ exp.unassignedClaimsCount }}</div>
            <div class="kpi-sub">New claims waiting to be picked up</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-title">Officer Active Workload</div>
            <div class="kpi-value mono" style="color: #4338ca;">{{ exp.openClaimsCount - exp.unassignedClaimsCount }}</div>
            <div class="kpi-sub">Assigned to {{ activePersona()?.name }} ({{ exp.awaitingClaimantInfoCount }} awaiting info)</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-title">Completed Decisions</div>
            <div class="kpi-value mono" style="color: #047857;">
              {{ exp.settledClaimsCount }} Approved / {{ exp.rejectedClaimsCount }} Rejected
            </div>
            <div class="kpi-sub">Total Approved Payouts: \${{ exp.totalSettledPayoutsUsd | number:'1.0-0' }} USD</div>
          </div>
        </div>

        <div class="workspace-split">
          <!-- LEFT: Incoming & Outstanding Claims Queue -->
          <div class="panel-card">
            <div class="panel-header">
              <div class="panel-title">Incoming & Outstanding Claims ({{ claims().length }})</div>
              <select class="filter-select" [ngModel]="filterStatus()" (ngModelChange)="filterStatus.set($event); loadClaims()">
                <option value="">All Claims</option>
                <option value="Submitted">Incoming (Unassigned)</option>
                <option value="UnderReview">Under Review</option>
                <option value="InfoRequested">Awaiting Claimant Info</option>
                <option value="Settled">Approved / Settled</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div class="claims-list">
              <div
                *ngFor="let c of claims()"
                class="claim-row"
                [class.selected]="selectedClaim()?.id === c.id"
                (click)="selectClaim(c.id)">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.45rem; margin-bottom: 0.25rem;">
                    <span class="market-pill">{{ c.market }}</span>
                    <span class="lob-pill">{{ c.claimType }}</span>
                    <strong class="mono">{{ c.claimNumber }}</strong>
                  </div>
                  <div style="font-size: 0.85rem; font-weight: 600;">{{ c.claimantName }} — {{ c.assetIdentifier }}</div>
                  <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.2rem;">
                    Officer: <strong>{{ c.assignedOfficerName || 'Unassigned (Click to Pick Up)' }}</strong>
                  </div>
                </div>

                <div style="text-align: right;">
                  <span class="status-badge" [ngClass]="'status-' + c.status">{{ formatStatus(c.status) }}</span>
                  <div class="mono" style="font-weight: 700; margin-top: 0.4rem;">
                    {{ c.currency }} {{ (c.settledAmount ?? c.assessedReserve ?? c.estimatedLoss) | number:'1.0-0' }}
                  </div>
                  <div class="mono" style="font-size: 0.72rem; color: var(--text-muted);" *ngIf="c.activeReserveExposureUsd > 0">
                    Liability: \${{ c.activeReserveExposureUsd | number:'1.0-0' }} USD
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT: Officer Claim Review & Decision Panel -->
          <div class="panel-card" *ngIf="selectedClaim() as detail">
            <div class="panel-header">
              <div>
                <strong class="mono" style="font-size: 1.05rem;">{{ detail.claimNumber }}</strong>
                <span style="color: var(--text-muted); font-size: 0.82rem; margin-left: 0.5rem;">• {{ detail.countryName }} ({{ detail.claimType }})</span>
              </div>
              <span class="status-badge" [ngClass]="'status-' + detail.status">{{ formatStatus(detail.status) }}</span>
            </div>

            <div style="padding: 1.25rem;">
              <!-- Claim Details Box -->
              <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.84rem; margin-bottom: 1rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.65rem;">
                  <div><span style="color: var(--text-muted);">Claimant:</span> <strong>{{ detail.claimantName }}</strong></div>
                  <div><span style="color: var(--text-muted);">Policy #:</span> <strong class="mono">{{ detail.policyNumber }}</strong></div>
                  <div><span style="color: var(--text-muted);">Claimed Loss:</span> <strong class="mono">{{ detail.currency }} {{ detail.estimatedLoss | number:'1.2-2' }}</strong></div>
                  <div><span style="color: var(--text-muted);">Pending Liability (USD):</span> <strong class="mono" style="color: #1d4ed8;">\${{ detail.activeReserveExposureUsd | number:'1.2-2' }}</strong></div>
                </div>
                <div style="border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                  <strong>Incident:</strong> {{ detail.incidentLocation }} — {{ detail.incidentDescription }}
                </div>
              </div>

              <!-- STEP 1: Pick Up / Assign Claim (If Submitted/Unassigned) -->
              <div
                *ngIf="detail.status === 'Submitted' || !detail.assignedOfficerId"
                class="action-box"
                style="background: #eff6ff; border-color: #93c5fd; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 700; color: #1e3a8a;">Incoming Unassigned Claim</div>
                  <div style="font-size: 0.8rem; color: #1d4ed8;">Pick up this claim to assign it to yourself and begin review.</div>
                </div>
                <button class="btn btn-primary" (click)="onPickUpClaim(detail.id)">
                  ✋ Pick Up & Assign to Me
                </button>
              </div>

              <!-- STEP 2: Officer Actions when Claim is Under Review -->
              <div *ngIf="detail.status === 'UnderReview'" style="display: flex; flex-direction: column; gap: 0.85rem;">
                <!-- Request Additional Info -->
                <div class="action-box" style="margin-top: 0;">
                  <div style="font-weight: 700; font-size: 0.84rem; color: #b45309; margin-bottom: 0.4rem;">
                    Need More Details from Claimant?
                  </div>
                  <div style="display: flex; gap: 0.5rem;">
                    <input
                      type="text"
                      class="form-control"
                      style="flex: 1;"
                      placeholder="Ask claimant for documents or clarification..."
                      [(ngModel)]="officerQuestionInput" />
                    <button class="btn btn-warning" [disabled]="!officerQuestionInput.trim()" (click)="onRequestInfo(detail.id)">
                      Request Info
                    </button>
                  </div>
                </div>

                <!-- Approve or Reject Claim -->
                <div class="action-box" style="margin-top: 0; background: #fff; border: 2px solid #cbd5e1;">
                  <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 0.65rem;">
                    Approve (Settle) or Reject Claim
                  </div>
                  <div class="form-grid">
                    <div class="form-group">
                      <label class="form-label">Approved Payout Amount ({{ detail.currency }})</label>
                      <input type="number" class="form-control mono" [(ngModel)]="settlementAmountInput" />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Decision / Rejection Notes</label>
                      <input type="text" class="form-control" placeholder="Reason for approval or rejection..." [(ngModel)]="decisionRationaleInput" />
                    </div>
                  </div>
                  <div style="display: flex; justify-content: flex-end; gap: 0.6rem;">
                    <button class="btn btn-danger" [disabled]="!decisionRationaleInput.trim()" (click)="onRejectClaim(detail.id)">
                      ✕ Reject Claim
                    </button>
                    <button class="btn btn-success" [disabled]="!decisionRationaleInput.trim() || settlementAmountInput <= 0" (click)="onSettleClaim(detail.id)">
                      ✓ Approve Claim
                    </button>
                  </div>
                </div>
              </div>

              <!-- Info Request History -->
              <div *ngIf="detail.informationRequests.length > 0" style="margin-top: 1rem;">
                <div style="font-size: 0.76rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.4rem;">
                  Requested Information Log
                </div>
                <div *ngFor="let ir of detail.informationRequests" style="background: #fffbeb; border: 1px solid #fde68a; padding: 0.7rem; border-radius: 6px; font-size: 0.82rem; margin-bottom: 0.4rem;">
                  <div><strong>Officer Asked:</strong> {{ ir.question }}</div>
                  <div *ngIf="ir.isResolved" style="color: #047857; margin-top: 0.3rem;">
                    <strong>✓ Claimant Replied:</strong> {{ ir.claimantResponse }}
                  </div>
                  <div *ngIf="!ir.isResolved" style="color: #b45309; margin-top: 0.3rem; font-weight: 600;">
                    ⏳ Waiting for Claimant to respond...
                  </div>
                </div>
              </div>

              <!-- Completed Decision Banner -->
              <div
                *ngIf="detail.status === 'Settled' || detail.status === 'Rejected'"
                style="padding: 1rem; border-radius: 8px; margin-top: 1rem;"
                [style.background]="detail.status === 'Settled' ? '#ecfdf5' : '#fef2f2'"
                [style.border]="detail.status === 'Settled' ? '1px solid #10b981' : '1px solid #ef4444'">
                <div style="font-weight: 800;" [style.color]="detail.status === 'Settled' ? '#047857' : '#b91c1c'">
                  {{ detail.status === 'Settled'
                    ? '✓ APPROVED (' + detail.currency + ' ' + (detail.settledAmount | number:'1.2-2') + ')'
                    : '✕ REJECTED' }}
                </div>
                <div style="font-size: 0.83rem; margin-top: 0.25rem;">{{ detail.decisionNotes }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- MODAL: Submit a New Insurance Claim -->
    <div class="modal-backdrop" *ngIf="showFnolModal()">
      <div class="modal-card">
        <div class="panel-header" style="background: var(--bg-navy); color: #fff;">
          <div class="panel-title" style="color: #fff;">Submit a New Insurance Claim</div>
          <button class="btn btn-outline" style="padding: 0.2rem 0.6rem;" (click)="showFnolModal.set(false)">✕</button>
        </div>

        <div style="padding: 1.25rem;">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">APAC Market</label>
              <select class="form-control" [(ngModel)]="fnolForm.market">
                <option *ngFor="let m of markets()" [value]="m.code">{{ m.code }} — {{ m.countryName }} ({{ m.currency }})</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Claim Type</label>
              <select class="form-control" [(ngModel)]="fnolForm.claimType">
                <option value="Motor">Motor</option>
                <option value="Property">Property</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Policy Number</label>
              <input type="text" class="form-control mono" [(ngModel)]="fnolForm.policyNumber" />
            </div>
            <div class="form-group">
              <label class="form-label">Vehicle Plate or Property Address</label>
              <input type="text" class="form-control" [(ngModel)]="fnolForm.assetIdentifier" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Incident Location</label>
              <input type="text" class="form-control" [(ngModel)]="fnolForm.incidentLocation" />
            </div>
            <div class="form-group">
              <label class="form-label">Claim Amount ({{ selectedMarketCurrency() }})</label>
              <input type="number" class="form-control mono" [(ngModel)]="fnolForm.estimatedLoss" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Incident Description</label>
            <textarea rows="3" class="form-control" [(ngModel)]="fnolForm.incidentDescription"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1rem;">
            <button class="btn btn-outline" (click)="showFnolModal.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="onSubmitFnol()">Submit Claim</button>
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
  readonly activeRole = signal<'Claimant' | 'ClaimsOfficer'>('Claimant');

  readonly claims = signal<ClaimSummary[]>([]);
  readonly selectedClaim = signal<ClaimDetail | null>(null);
  readonly analytics = signal<ExposureAnalytics | null>(null);
  readonly toastMessage = signal<string | null>(null);
  readonly filterStatus = signal<string>('');

  claimantResponseText = '';
  officerQuestionInput = '';
  settlementAmountInput = 0;
  decisionRationaleInput = '';

  readonly showFnolModal = signal<boolean>(false);
  fnolForm = {
    market: 'SG',
    claimType: 'Motor',
    policyNumber: 'SG-MTR-994120',
    assetIdentifier: 'SBA 9912 E (Honda CR-V)',
    incidentLocation: 'Orchard Road, Singapore',
    incidentDescription: 'Rear bumper collision at traffic light.',
    estimatedLoss: 8500
  };

  readonly claimantUser = computed(() => this.personas().find(p => p.role === 'Claimant') || null);
  readonly officerUser = computed(() => this.personas().find(p => p.role === 'ClaimsOfficer') || null);
  readonly activePersona = computed(() =>
    this.activeRole() === 'Claimant' ? this.claimantUser() : this.officerUser()
  );

  readonly selectedMarketCurrency = computed(() => {
    const found = this.markets().find(m => m.code === this.fnolForm.market);
    return found ? found.currency : 'SGD';
  });

  ngOnInit(): void {
    this.api
      .getBootstrapMetadata(() => {
        this.loadClaims(false);
        this.loadAnalytics();
      })
      .subscribe(meta => {
        this.markets.set(meta.markets);
        this.personas.set(meta.personas);
        this.loadClaims(true);
        this.loadAnalytics();
      });
  }

  switchRole(role: 'Claimant' | 'ClaimsOfficer'): void {
    this.activeRole.set(role);
    this.filterStatus.set('');
    this.loadClaims(true);
    this.loadAnalytics();
  }

  loadClaims(autoSelectFirst = false): void {
    const persona = this.activePersona();
    const filters =
      this.activeRole() === 'Claimant'
        ? { claimantId: persona?.id || 'clm-tan' }
        : { status: this.filterStatus() || undefined };

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
    this.api.getExposureAnalytics().subscribe(exp => this.analytics.set(exp));
  }

  selectClaim(id: string, resetInputs = true): void {
    this.api.getClaimById(id, this.activePersona()).subscribe(detail => {
      this.selectedClaim.set(detail);
      if (resetInputs) {
        this.settlementAmountInput = detail.assessedReserve ?? detail.estimatedLoss;
        this.officerQuestionInput = '';
        this.decisionRationaleInput = '';
        this.claimantResponseText = '';
      }
    });
  }

  openFnolModal(): void {
    this.showFnolModal.set(true);
  }

  onSubmitFnol(): void {
    this.api
      .submitClaim(this.activePersona(), {
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
        this.showToast(`Claim ${created.claimNumber} submitted!`);
        this.loadClaims(false);
        this.loadAnalytics();
        this.selectClaim(created.id);
      });
  }

  onPickUpClaim(claimId: string): void {
    this.api.pickUpClaim(claimId, this.activePersona()).subscribe(updated => {
      this.selectedClaim.set(updated);
      this.showToast(`Claim ${updated.claimNumber} picked up and assigned to ${this.activePersona()?.name}.`);
      this.loadClaims(false);
      this.loadAnalytics();
    });
  }

  onRequestInfo(claimId: string): void {
    this.api.requestInfo(claimId, this.activePersona(), this.officerQuestionInput).subscribe(updated => {
      this.selectedClaim.set(updated);
      this.officerQuestionInput = '';
      this.showToast(`Requested additional info from ${updated.claimantName}.`);
      this.loadClaims(false);
      this.loadAnalytics();
    });
  }

  onSubmitClaimantResponse(claimId: string): void {
    this.api
      .respondToInfo(claimId, this.activePersona(), {
        response: this.claimantResponseText
      })
      .subscribe(updated => {
        this.selectedClaim.set(updated);
        this.claimantResponseText = '';
        this.showToast(`Additional information sent! Claim returned to Under Review.`);
        this.loadClaims(false);
        this.loadAnalytics();
      });
  }

  onSettleClaim(claimId: string): void {
    this.api
      .settleClaim(claimId, this.activePersona(), {
        settledAmount: Number(this.settlementAmountInput),
        decisionNotes: this.decisionRationaleInput
      })
      .subscribe(updated => {
        this.selectedClaim.set(updated);
        this.showToast(`Claim ${updated.claimNumber} Approved!`);
        this.loadClaims(false);
        this.loadAnalytics();
      });
  }

  onRejectClaim(claimId: string): void {
    this.api.rejectClaim(claimId, this.activePersona(), this.decisionRationaleInput).subscribe(updated => {
      this.selectedClaim.set(updated);
      this.showToast(`Claim ${updated.claimNumber} Rejected.`);
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
      case 'Settled': return 'Approved';
      default: return status;
    }
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) this.toastMessage.set(null);
    }, 5000);
  }
}
