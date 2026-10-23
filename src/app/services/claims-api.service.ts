import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
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

  // Supports both http://localhost:5150 (launchSettings) and https://localhost:5001 (VS Code C# debugger default)
  readonly activeServerOrigin = signal<string>('http://localhost:5150');
  readonly apiError = signal<string | null>(null);
  private hubConnection?: signalR.HubConnection;

  readonly signalRConnected = signal<boolean>(false);
  readonly lastLiveEvent = signal<{ eventType: string; claimId: string; timestamp: string } | null>(null);

  private get baseUrl(): string {
    return `${this.activeServerOrigin()}/api`;
  }

  private get hubUrl(): string {
    return `${this.activeServerOrigin()}/hubs/claims`;
  }

  private buildHeaders(persona: Persona | null): HttpHeaders {
    if (!persona) return new HttpHeaders();
    return new HttpHeaders({
      'X-Demo-User-Id': persona.id,
      'X-Demo-User-Name': persona.name,
      'X-Demo-Role': persona.role
    });
  }

  connectSignalR(onEventCallback: () => void): void {
    if (this.hubConnection) {
      this.hubConnection.stop().catch(() => {});
      this.hubConnection = undefined;
    }

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

  getBootstrapMetadata(onEventCallback?: () => void): Observable<BootstrapMetadata> {
    return this.http.get<BootstrapMetadata>(`${this.baseUrl}/metadata/bootstrap`).pipe(
      tap(() => {
        this.apiError.set(null);
        if (onEventCallback) this.connectSignalR(onEventCallback);
      }),
      catchError(() => {
        // Fallback to https://localhost:5001 if started via VS Code debugger without launchSettings
        this.activeServerOrigin.set('https://localhost:5001');
        return this.http.get<BootstrapMetadata>(`${this.baseUrl}/metadata/bootstrap`).pipe(
          tap(() => {
            this.apiError.set(null);
            if (onEventCallback) this.connectSignalR(onEventCallback);
          }),
          catchError(() => {
            this.activeServerOrigin.set('http://localhost:5000');
            return this.http.get<BootstrapMetadata>(`${this.baseUrl}/metadata/bootstrap`).pipe(
              tap(() => {
                this.apiError.set(null);
                if (onEventCallback) this.connectSignalR(onEventCallback);
              }),
              catchError(err => {
                this.apiError.set(
                  'Cannot reach Chubb.Claims.Api on http://localhost:5150 or https://localhost:5001. Ensure the .NET 10 API is running.'
                );
                return throwError(() => err);
              })
            );
          })
        );
      })
    );
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

  getAnalyticsSummary(): Observable<ExposureAnalytics> {
    return this.http.get<ExposureAnalytics>(`${this.baseUrl}/analytics/summary`);
  }
}
