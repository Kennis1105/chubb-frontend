export interface MarketMetadata {
  code: string;
  countryName: string;
  currency: string;
  fxRateToUsd: number;
}

export interface Persona {
  id: string;
  name: string;
  role: 'Claimant' | 'ClaimsOfficer' | 'ClaimsManager';
  market: string;
  title: string;
  email: string;
  phone: string;
}

export interface BootstrapMetadata {
  markets: MarketMetadata[];
  claimTypes: string[];
  claimStatuses: string[];
  personas: Persona[];
}

export interface ClaimSummary {
  id: string;
  claimNumber: string;
  policyNumber: string;
  market: string;
  countryName: string;
  claimType: string;
  status: 'Submitted' | 'UnderReview' | 'InfoRequested' | 'Settled' | 'Rejected';
  claimantId: string;
  claimantName: string;
  incidentDateUtc: string;
  incidentLocation: string;
  assetIdentifier: string;
  currency: string;
  estimatedLoss: number;
  assessedReserve: number | null;
  settledAmount: number | null;
  activeReserveExposure: number;
  activeReserveExposureUsd: number;
  assignedOfficerId: string | null;
  assignedOfficerName: string | null;
  hasOpenInfoRequest: boolean;
  submittedAtUtc: string;
  updatedAtUtc: string;
}

export interface ClaimInformationRequest {
  id: string;
  question: string;
  requestedByOfficerId: string;
  requestedByOfficerName: string;
  requestedAtUtc: string;
  claimantResponse: string | null;
  supportingDocumentRef: string | null;
  respondedAtUtc: string | null;
  isResolved: boolean;
}

export interface ClaimNote {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  isInternalOnly: boolean;
  createdAtUtc: string;
}

export interface ClaimAuditEntry {
  id: string;
  action: string;
  description: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  occurredAtUtc: string;
}

export interface ClaimDetail extends ClaimSummary {
  claimantEmail: string;
  claimantPhone: string;
  incidentDescription: string;
  fxRateToUsd: number;
  decisionNotes: string | null;
  closedAtUtc: string | null;
  informationRequests: ClaimInformationRequest[];
  notes: ClaimNote[];
  auditTrail: ClaimAuditEntry[];
}

export interface MarketExposureBreakdown {
  market: string;
  countryName: string;
  currency: string;
  fxRateToUsd: number;
  totalClaimsCount: number;
  openClaimsCount: number;
  activeReserveNative: number;
  activeReserveUsd: number;
  settledPayoutNative: number;
  settledPayoutUsd: number;
}

export interface ClaimTypeBreakdown {
  claimType: string;
  openClaimsCount: number;
  totalClaimsCount: number;
  activeReserveUsd: number;
  settledPayoutUsd: number;
}

export interface OfficerWorkload {
  officerId: string;
  officerName: string;
  primaryMarkets: string;
  activeUnderReviewCount: number;
  awaitingInfoCount: number;
  settledCount: number;
  rejectedCount: number;
  activeReserveManagedUsd: number;
  averageResolutionHours: number;
}

export interface EventStreamItem {
  eventId: string;
  claimId: string;
  eventType: string;
  topic: string;
  transportMode: string;
  occurredAtUtc: string;
  processedAtUtc: string | null;
  summaryJson: string;
}

export interface ExposureAnalytics {
  totalActiveLiabilityExposureUsd: number;
  totalSettledPayoutsUsd: number;
  totalReleasedReservesUsd: number;
  totalClaimsCount: number;
  openClaimsCount: number;
  unassignedClaimsCount: number;
  awaitingClaimantInfoCount: number;
  settledClaimsCount: number;
  rejectedClaimsCount: number;
  byMarket: MarketExposureBreakdown[];
  byClaimType: ClaimTypeBreakdown[];
  teamWorkload: OfficerWorkload[];
  recentEventStream: EventStreamItem[];
}
