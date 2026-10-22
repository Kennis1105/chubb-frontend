import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import {
  BootstrapMetadata,
  ClaimDetail,
  ClaimSummary,
  ExposureAnalytics,
  Persona
} from '../models/claims.models';

@Injectable({ providedIn: 'root' })
export class ClaimsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:5150/api';
  private readonly hubUrl = 'http://localhost:5150/hubs/claims';
  private hubConnection?: signalR.HubConnection;

  readonly signalRConnected = signal<boolean>(false);
  readonly lastLiveEvent = signal<{ eventType: string; claimId: string; timestamp: string } | null>(null);

  private buildHeaders(persona: Persona | null): HttpHeaders {
    if (!persona) return new HttpHeaders();
    return new HttpHeaders({
      'X-Demo-User-Id': persona.id,
      'X-Demo-User-Name': persona.name,
      'X-Demo-Role': persona.role
    });
  }

  connectSignalR(onEventCallback: () => void): void {
    if (this.hubConnection) return;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.hubUrl)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('connected', () => {
      this.signalRConnected.set(true);
    });

    this.hubConnection.on('claimDomainEvent', (evt: any) => {
      this.lastLiveEvent.set({
        eventType: evt.eventType,
        claimId: evt.claimId,
        timestamp: evt.processedAtUtc || new Date().toISOString()
      });
      onEventCallback();
    });

    this.hubConnection
      .start()
      .then(() => this.signalRConnected.set(true))
      .catch(() => this.signalRConnected.set(false));
  }

  getBootstrapMetadata(): Observable<BootstrapMetadata> {
    return this.http.get<BootstrapMetadata>(`${this.baseUrl}/metadata/bootstrap`);
  }

  getClaims(
    persona: Persona | null,
    filters: {
      market?: string;
      claimType?: string;
      status?: string;
      claimantId?: string;
      assignedOfficerId?: string;
      search?: string;
    }
  ): Observable<ClaimSummary[]> {
    let params = new HttpParams();
    if (filters.market) params = params.set('market', filters.market);
    if (filters.claimType) params = params.set('claimType', filters.claimType);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.claimantId) params = params.set('claimantId', filters.claimantId);
    if (filters.assignedOfficerId) params = params.set('assignedOfficerId', filters.assignedOfficerId);
    if (filters.search) params = params.set('search', filters.search);

    return this.http.get<ClaimSummary[]>(`${this.baseUrl}/claims`, {
      params,
      headers: this.buildHeaders(persona)
    });
  }

  getClaimById(id: string, persona: Persona | null): Observable<ClaimDetail> {
    return this.http.get<ClaimDetail>(`${this.baseUrl}/claims/${id}`, {
      headers: this.buildHeaders(persona)
    });
  }

  submitClaim(
    persona: Persona | null,
    payload: {
      policyNumber: string;
      market: string;
      claimType: string;
      incidentDateUtc: string;
      incidentLocation: string;
      incidentDescription: string;
      assetIdentifier: string;
      estimatedLoss: number;
    }
  ): Observable<ClaimDetail> {
    return this.http.post<ClaimDetail>(
      `${this.baseUrl}/claims`,
      {
        ...payload,
        claimantId: persona?.id,
        claimantName: persona?.name,
        claimantEmail: persona?.email,
        claimantPhone: persona?.phone
      },
      { headers: this.buildHeaders(persona) }
    );
  }

  pickUpClaim(claimId: string, persona: Persona | null): Observable<ClaimDetail> {
    return this.http.post<ClaimDetail>(
      `${this.baseUrl}/claims/${claimId}/pickup`,
      { officerId: persona?.id, officerName: persona?.name },
      { headers: this.buildHeaders(persona) }
    );
  }

  updateAssessment(
    claimId: string,
    persona: Persona | null,
    payload: { assessedReserve?: number | null; internalNote?: string | null }
  ): Observable<ClaimDetail> {
    return this.http.put<ClaimDetail>(
      `${this.baseUrl}/claims/${claimId}/assessment`,
      {
        ...payload,
        officerId: persona?.id,
        officerName: persona?.name
      },
      { headers: this.buildHeaders(persona) }
    );
  }

  requestInfo(claimId: string, persona: Persona | null, question: string): Observable<ClaimDetail> {
    return this.http.post<ClaimDetail>(
      `${this.baseUrl}/claims/${claimId}/request-info`,
      {
        question,
        officerId: persona?.id,
        officerName: persona?.name
      },
      { headers: this.buildHeaders(persona) }
    );
  }

  respondToInfo(
    claimId: string,
    persona: Persona | null,
    payload: { response: string; supportingDocumentRef?: string }
  ): Observable<ClaimDetail> {
    return this.http.post<ClaimDetail>(
      `${this.baseUrl}/claims/${claimId}/respond-info`,
      {
        ...payload,
        claimantId: persona?.id,
        claimantName: persona?.name
      },
      { headers: this.buildHeaders(persona) }
    );
  }

  settleClaim(
    claimId: string,
    persona: Persona | null,
    payload: { settledAmount: number; decisionNotes: string }
  ): Observable<ClaimDetail> {
    return this.http.post<ClaimDetail>(
      `${this.baseUrl}/claims/${claimId}/settle`,
      {
        ...payload,
        officerId: persona?.id,
        officerName: persona?.name
      },
      { headers: this.buildHeaders(persona) }
    );
  }

  rejectClaim(
    claimId: string,
    persona: Persona | null,
    rejectionReason: string
  ): Observable<ClaimDetail> {
    return this.http.post<ClaimDetail>(
      `${this.baseUrl}/claims/${claimId}/reject`,
      {
        rejectionReason,
        officerId: persona?.id,
        officerName: persona?.name
      },
      { headers: this.buildHeaders(persona) }
    );
  }

  getExposureAnalytics(): Observable<ExposureAnalytics> {
    return this.http.get<ExposureAnalytics>(`${this.baseUrl}/analytics/exposure`);
  }
}
