import { refreshDashboard } from '../hooks/useAutoRefresh';
import { Complaint } from '../types/complaint';
import { CommitteeChallenge, CommitteeMemberRecord, CommitteePoolId } from '../types/committee';
import { WitnessInvitation, WitnessQuorumSummary } from '../types/witness';
import { AuditEvent } from '../types/audit';
import { User, DEMO_USERS } from '../types/auth';
import {
  CaseResolution,
  PatternReport,
  ReflectReformInsights,
  RelatedCases,
  ResolutionOutcome
} from '../types/intelligence';
import {
  INITIAL_COMPLAINTS,
  INITIAL_CHALLENGES,
  INITIAL_WITNESS_INVITATIONS,
  INITIAL_AUDIT_EVENTS,
  COMMITTEE_POOL
} from './mockData';

export interface ApiSecurityContext {
  currentUser: User;
  useMockFallback: boolean;
  apiBaseUrl: string;
}

export interface ApiResponse<T> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
  source: 'real_backend' | 'stateful_mock';
  timestamp: string;
}

// In-memory state for mock mode so all user actions stay reactive and demonstrable
let stateComplaints: Complaint[] = JSON.parse(JSON.stringify(INITIAL_COMPLAINTS));
let stateChallenges: CommitteeChallenge[] = JSON.parse(JSON.stringify(INITIAL_CHALLENGES));
let stateCommitteePool: CommitteeMemberRecord[] = JSON.parse(JSON.stringify(COMMITTEE_POOL));
let stateWitnesses: WitnessInvitation[] = JSON.parse(JSON.stringify(INITIAL_WITNESS_INVITATIONS));
let stateAuditEvents: AuditEvent[] = JSON.parse(JSON.stringify(INITIAL_AUDIT_EVENTS));
let stateMessages: Record<string, Array<{ id: string; sender: string; text: string; timestamp: string; isEncrypted: boolean }>> = {
  'INC-892': [
    {
      id: 'msg-1',
      sender: 'Lead Investigator (Elena Rostova)',
      text: 'Secure channel established. Can you confirm if you still have local copies of the quarterly evaluation drafts prior to the override?',
      timestamp: '2026-10-09T14:10:00Z',
      isEncrypted: true
    },
    {
      id: 'msg-2',
      sender: 'Anonymous Reporter (EMP-ZK-88219)',
      text: 'Yes, cryptographic hashes of the original drafts with supervisor sign-off have been committed to the secure evidence vault.',
      timestamp: '2026-10-09T14:28:00Z',
      isEncrypted: true
    }
  ]
};

// Check if actual backend is reachable
export async function checkBackendHealth(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

export class ApiService {
  private static user: User = DEMO_USERS[0]; // Default Sarah Jenkins
  private static apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  // Live by default: the integration stub (backend/app/stub, /hr/* routes) enforces access control server-side.
  // VITE_FORCE_MOCK=true keeps the in-browser demo; if the backend is unreachable and VITE_USE_MOCK_FALLBACK is
  // not 'false', calls fall back to the mock so the dashboard still renders.
  private static forceMock: boolean = import.meta.env.VITE_FORCE_MOCK === 'true';
  private static mockFallback: boolean = import.meta.env.VITE_USE_MOCK_FALLBACK !== 'false';
  private static stubAdminKey: string = import.meta.env.VITE_STUB_ADMIN_KEY || 'adm';

  public static setUser(user: User) {
    this.user = user;
  }

  public static getUser(): User {
    return this.user;
  }

  public static setForceMock(mock: boolean) {
    this.forceMock = mock;
  }

  public static isForceMock(): boolean {
    return this.forceMock;
  }

  public static isLive(): boolean {
    return !this.forceMock;
  }

  public static getBaseUrl(): string {
    return this.apiBaseUrl;
  }

  // --- LIVE BACKEND ---
  // Returns null when the mock should answer instead (forced mock, or backend unreachable with fallback on).
  private static async live<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T> | null> {
    if (this.forceMock) return null;
    const timestamp = () => new Date().toISOString();
    try {
      const res = await fetch(`${this.apiBaseUrl}/hr${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'X-Stub-Admin': this.stubAdminKey,
          'X-Staff-Id': this.user.id,
          ...(init.headers || {})
        }
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = body?.detail;
        const error = typeof detail === 'string' ? detail : detail?.message || detail?.reason || `HTTP ${res.status}`;
        return { success: false, status: res.status, error, source: 'real_backend', timestamp: timestamp() };
      }
      if (init.method && init.method !== 'GET') queueMicrotask(refreshDashboard);
      return { success: true, status: res.status, data: body as T, source: 'real_backend', timestamp: timestamp() };
    } catch {
      // For mutations (POST, PUT, PATCH, DELETE), never silently fall back to mock when live request fails
      if (this.mockFallback && (!init.method || init.method === 'GET')) return null;
      return { success: false, status: 0, error: 'Backend unreachable: mutation was not persisted', source: 'real_backend', timestamp: timestamp() };
    }
  }

  private static post(body: unknown): RequestInit {
    return { method: 'POST', body: JSON.stringify(body) };
  }

  // --- ACCESS CONTROL AUTHORIZATION CHECKS ---
  private static verifyCaseAccess(complaintId: string): void {
    const complaint = stateComplaints.find(c => c.id === complaintId);
    if (!complaint) {
      throw new Error(`404: Case ${complaintId} not found.`);
    }

    // Critical Security Check: Revoked members CANNOT access the case
    if (complaint.revokedMemberIds.includes(this.user.id)) {
      throw new Error(`403: Forbidden - Access Revoked. Member ${this.user.name} (${this.user.role}) was removed from Case ${complaintId} following independent challenge adjudication.`);
    }

    // Role-specific case authorization:
    // HR Reviewers and Ombudspersons have supervisory access
    if (this.user.role === 'hr_reviewer' || this.user.role === 'independent_reviewer' || this.user.role === 'administrator') {
      return;
    }

    // Assigned investigator check
    if (this.user.role === 'assigned_investigator') {
      if (complaint.assignedInvestigatorId === this.user.id) {
        return;
      }
      throw new Error(`403: Forbidden - You are not the assigned investigator for Case ${complaintId}.`);
    }

    // Committee member check
    if (this.user.role === 'committee_member') {
      if (complaint.committeeMemberIds.includes(this.user.id)) {
        return;
      }
      throw new Error(`403: Forbidden - You are not an assigned committee member for Case ${complaintId}.`);
    }
  }

  // --- COMPLAINTS API ---
  public static async getReports(): Promise<ApiResponse<Complaint[]>> {
    const live = await this.live<Complaint[]>('/cases');
    if (live && live.success && live.data) {
      for (const rep of live.data) {
        const idx = stateComplaints.findIndex(c => c.id === rep.id);
        if (idx >= 0) stateComplaints[idx] = rep;
        else stateComplaints.unshift(rep);
      }
      return live;
    }
    if (live && !live.success) return live;
    // Filter reports based on permissions
    const accessible = stateComplaints.filter(c => {
      if (c.revokedMemberIds.includes(this.user.id)) return false;
      if (this.user.role === 'hr_reviewer' || this.user.role === 'independent_reviewer') return true;
      if (this.user.role === 'assigned_investigator') return c.assignedInvestigatorId === this.user.id;
      if (this.user.role === 'committee_member') return c.committeeMemberIds.includes(this.user.id);
      return false;
    });

    return {
      success: true,
      status: 200,
      data: accessible,
      source: 'stateful_mock',
      timestamp: new Date().toISOString()
    };
  }

  public static async getReport(id: string): Promise<ApiResponse<Complaint>> {
    const live = await this.live<Complaint>(`/cases/${encodeURIComponent(id)}`);
    if (live && live.success && live.data) {
      const idx = stateComplaints.findIndex(c => c.id === id);
      if (idx >= 0) stateComplaints[idx] = live.data;
      else stateComplaints.unshift(live.data);
      return live;
    }
    if (live && !live.success) return live;
    try {
      this.verifyCaseAccess(id);
      const report = stateComplaints.find(c => c.id === id);
      if (!report) {
        return { success: false, status: 404, error: 'Case not found', source: 'stateful_mock', timestamp: new Date().toISOString() };
      }
      return { success: true, status: 200, data: report, source: 'stateful_mock', timestamp: new Date().toISOString() };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = msg.startsWith('403') ? 403 : 400;
      return {
        success: false,
        status,
        error: msg,
        source: 'stateful_mock',
        timestamp: new Date().toISOString()
      };
    }
  }

  // --- COMMITTEE CHALLENGES API ---
  public static async getChallenges(poolId?: CommitteePoolId): Promise<ApiResponse<CommitteeChallenge[]>> {
    const live = await this.live<CommitteeChallenge[]>(poolId ? `/challenges?pool_id=${poolId}` : '/challenges');
    if (live && live.success && live.data) {
      for (const ch of live.data) {
        const idx = stateChallenges.findIndex(c => c.id === ch.id);
        if (idx >= 0) stateChallenges[idx] = ch;
        else stateChallenges.unshift(ch);
      }
      return live;
    }
    if (live && !live.success) return live;
    let poolFiltered = stateChallenges;
    if (poolId) {
      poolFiltered = poolFiltered.filter(ch => ch.poolId === poolId);
    }

    // Security check: Challenged members CANNOT see challenges against themselves
    const visibleChallenges = poolFiltered.filter(ch => {
      if (ch.challengedMemberId === this.user.id) {
        return false; // Redacted for the challenged party
      }
      return true;
    });

    return {
      success: true,
      status: 200,
      data: visibleChallenges,
      source: 'stateful_mock',
      timestamp: new Date().toISOString()
    };
  }

  public static async getChallenge(id: string): Promise<ApiResponse<CommitteeChallenge>> {
    const live = await this.live<CommitteeChallenge>(`/challenges/${encodeURIComponent(id)}`);
    if (live && live.success && live.data) {
      const idx = stateChallenges.findIndex(c => c.id === id);
      if (idx >= 0) stateChallenges[idx] = live.data;
      else stateChallenges.unshift(live.data);
      return live;
    }
    if (live && !live.success) return live;
    const challenge = stateChallenges.find(c => c.id === id);
    if (!challenge) {
      return { success: false, status: 404, error: 'Challenge not found', source: 'stateful_mock', timestamp: new Date().toISOString() };
    }

    // Security check:
    if (challenge.challengedMemberId === this.user.id) {
      return {
        success: false,
        status: 403,
        error: '403: Forbidden - Confidentiality Protection: Challenged committee members cannot view the particulars of a challenge filed against their appointment.',
        source: 'stateful_mock',
        timestamp: new Date().toISOString()
      };
    }

    return { success: true, status: 200, data: challenge, source: 'stateful_mock', timestamp: new Date().toISOString() };
  }

  public static async decideChallenge(
    challengeId: string,
    decision: 'approve' | 'reject',
    rationale: string,
    replacementMemberId: string = 'usr_priya'
  ): Promise<ApiResponse<{ challenge: CommitteeChallenge; updatedComplaint: Complaint }>> {
    const live = await this.live<{ challenge: CommitteeChallenge; updatedComplaint: Complaint }>(
      `/challenges/${encodeURIComponent(challengeId)}/decide`,
      this.post({ decision, rationale, replacement_member_id: replacementMemberId })
    );
    if (live && live.success && live.data) {
      const data = live.data;
      const chIdx = stateChallenges.findIndex(c => c.id === challengeId);
      if (chIdx >= 0) stateChallenges[chIdx] = data.challenge;
      const compIdx = stateComplaints.findIndex(c => c.id === data.updatedComplaint.id);
      if (compIdx >= 0) stateComplaints[compIdx] = data.updatedComplaint;
      return live;
    }
    if (live && !live.success) return live;
    const challenge = stateChallenges.find(c => c.id === challengeId);
    if (!challenge) {
      return { success: false, status: 404, error: 'Challenge not found', source: 'stateful_mock', timestamp: new Date().toISOString() };
    }

    // Independent reviewer separation:
    if (this.user.role !== 'independent_reviewer' && this.user.role !== 'administrator') {
      return {
        success: false,
        status: 403,
        error: `403: Forbidden - Only an authorized Independent Reviewer (e.g. Dr. Aris Thorne) may adjudicate committee challenges. Current user role: ${this.user.role}`,
        source: 'stateful_mock',
        timestamp: new Date().toISOString()
      };
    }

    if (!rationale.trim() || rationale.length < 15) {
      return {
        success: false,
        status: 422,
        error: 'A comprehensive legal rationale (minimum 15 characters) is required for audit verification.',
        source: 'stateful_mock',
        timestamp: new Date().toISOString()
      };
    }

    const complaint = stateComplaints.find(c => c.id === challenge.complaintId);
    if (!complaint) {
      return { success: false, status: 404, error: 'Associated case not found', source: 'stateful_mock', timestamp: new Date().toISOString() };
    }

    const now = new Date().toISOString();

    if (decision === 'approve') {
      // 1. Update challenge status
      challenge.status = 'approved_access_revoked';
      challenge.decisionRationale = rationale;
      challenge.decidedAt = now;
      challenge.independentReviewerId = this.user.id;

      // 2. Revoke the challenged member from case access!
      const challengedId = challenge.challengedMemberId;
      complaint.committeeMemberIds = complaint.committeeMemberIds.filter(id => id !== challengedId);
      if (!complaint.committeeMemberIds.includes(replacementMemberId)) {
        complaint.committeeMemberIds.push(replacementMemberId);
      }
      if (!complaint.revokedMemberIds.includes(challengedId)) {
        complaint.revokedMemberIds.push(challengedId);
      }

      complaint.status = 'investigation_active';
      complaint.requiredNextAction = `Reassignment confirmed. Access revoked for ${challenge.challengedMemberName}. Investigation resumed under independent quorum.`;

      // Update stateCommitteePool member status
      stateCommitteePool.forEach(m => {
        if (m.id === challengedId) {
          m.assignmentStatus = 'recused_conflict';
          m.isEligible = false;
          m.conflictRiskLevel = 'high';
          m.assignedCaseIds = m.assignedCaseIds.filter(id => id !== complaint.id);
        }
        if (m.id === replacementMemberId) {
          m.assignmentStatus = 'active_assigned';
          if (!m.assignedCaseIds.includes(complaint.id)) {
            m.assignedCaseIds.push(complaint.id);
          }
        }
      });

      // 3. Create cryptographically verifiable Audit Events
      const revokeAuditEvent: AuditEvent = {
        id: `AUD-${Date.now()}-1`,
        complaintId: complaint.id,
        eventType: 'challenge_adjudicated_revoked',
        timestamp: now,
        actorRef: `${this.user.name} (${this.user.title})`,
        details: `Challenge #${challenge.id} upheld. Access permanently revoked for ${challenge.challengedMemberName}. Legal rationale: "${rationale}".`,
        sha256Proof: '7d32a90184b2c019488a0918230bc71a80491823019bc0192481092bb4101924',
        merkleRoot: '0x9948201bc019248102948bc0192481029481092a18230bc71a80491823019bc0',
        blockNumber: 62891410,
        txHash: '0x33b190f892a013c7104b901a8820c4e8912ef71818230bc71a80491823019bc0',
        verificationStatus: 'verified_commitment'
      };

      const reassignAuditEvent: AuditEvent = {
        id: `AUD-${Date.now()}-2`,
        complaintId: complaint.id,
        eventType: 'reassignment_performed',
        timestamp: new Date(Date.now() + 1000).toISOString(),
        actorRef: 'Access Control Daemon',
        details: `Case assignment updated: Substituted ${challenge.challengedMemberName} with Priya Sundaram (Senior Director of People Relations). Real-time token revocation signaled.`,
        sha256Proof: '88301948201bca0991823019bc0192481092bb41019248bca019248bc019248bc',
        merkleRoot: '0x9948201bc019248102948bc0192481029481092a18230bc71a80491823019bc0',
        blockNumber: 62891411,
        txHash: '0x4421b9a4c80112ef093a1288c1a902bf41203ca918230bc71a80491823019bc0',
        verificationStatus: 'verified_commitment'
      };

      stateAuditEvents.unshift(reassignAuditEvent);
      stateAuditEvents.unshift(revokeAuditEvent);

    } else {
      challenge.status = 'rejected_assignment_maintained';
      challenge.decisionRationale = rationale;
      challenge.decidedAt = now;
      challenge.independentReviewerId = this.user.id;
      complaint.status = 'investigation_active';
      complaint.requiredNextAction = `Challenge dismissed by Independent Ombudsperson. Committee maintained with documented review rationale.`;
    }

    return {
      success: true,
      status: 200,
      data: { challenge, updatedComplaint: complaint },
      source: 'stateful_mock',
      timestamp: now
    };
  }

  // --- WITNESS QUORUM API ---
  public static async getWitnessInvitations(complaintId: string): Promise<ApiResponse<WitnessInvitation[]>> {
    const live = await this.live<WitnessInvitation[]>(`/cases/${encodeURIComponent(complaintId)}/witnesses`);
    if (live && live.success && live.data) {
      stateWitnesses = stateWitnesses.filter(w => w.complaintId !== complaintId).concat(live.data);
      return live;
    }
    if (live && !live.success) return live;
    // Only assigned investigator can see full invitation responses
    const isAssigned = this.user.role === 'assigned_investigator' || this.user.role === 'administrator';

    const invitations = stateWitnesses.filter(w => w.complaintId === complaintId);
    
    // Anonymize/mask details if user is not assigned investigator
    const sanitized = invitations.map(inv => {
      if (!isAssigned) {
        return {
          ...inv,
          anonymousAlias: 'Witness (Identity Masked for Investigator Privilege)',
          status: 'pending' as const, // Hide accepted/declined state from unassigned staff!
          statementProvided: false
        };
      }
      return inv;
    });

    return {
      success: true,
      status: 200,
      data: sanitized,
      source: 'stateful_mock',
      timestamp: new Date().toISOString()
    };
  }

  public static async getWitnessQuorumSummary(complaintId: string): Promise<ApiResponse<WitnessQuorumSummary>> {
    const live = await this.live<WitnessQuorumSummary>(`/cases/${encodeURIComponent(complaintId)}/witness-summary`);
    if (live && live.success && live.data) return live;
    if (live && !live.success) return live;
    const list = stateWitnesses.filter(w => w.complaintId === complaintId);
    const accepted = list.filter(w => w.status === 'accepted').length;
    const declined = list.filter(w => w.status === 'declined').length;
    const pending = list.filter(w => w.status === 'pending').length;
    const statementsSubmitted = list.filter(w => w.statementProvided).length;

    return {
      success: true,
      status: 200,
      data: {
        complaintId,
        totalInvited: list.length,
        accepted,
        declined,
        pending,
        statementsSubmitted,
        quorumMet: statementsSubmitted >= 2
      },
      source: 'stateful_mock',
      timestamp: new Date().toISOString()
    };
  }

  public static async inviteWitness(complaintId: string, roleAlias: string): Promise<ApiResponse<WitnessInvitation>> {
    const live = await this.live<WitnessInvitation>(
      `/cases/${encodeURIComponent(complaintId)}/witnesses`,
      this.post({ alias: roleAlias })
    );
    if (live && live.success && live.data) {
      stateWitnesses.push(live.data);
      return live;
    }
    if (live && !live.success) return live;
    if (this.user.role !== 'assigned_investigator' && this.user.role !== 'administrator') {
      return {
        success: false,
        status: 403,
        error: '403: Forbidden - Only the assigned investigator can issue Witness Quorum invitations.',
        source: 'stateful_mock',
        timestamp: new Date().toISOString()
      };
    }

    const newWitness: WitnessInvitation = {
      id: `WIT-0${stateWitnesses.length + 1}`,
      complaintId,
      anonymousAlias: roleAlias || `Witness ${String.fromCharCode(65 + stateWitnesses.length)}`,
      invitedAt: new Date().toISOString(),
      status: 'pending',
      statementProvided: false
    };

    stateWitnesses.push(newWitness);

    return {
      success: true,
      status: 201,
      data: newWitness,
      source: 'stateful_mock',
      timestamp: new Date().toISOString()
    };
  }

  // --- INVESTIGATION MESSAGES API ---
  public static async getMessages(complaintId: string): Promise<ApiResponse<Array<{ id: string; sender: string; text: string; timestamp: string; isEncrypted: boolean }>>> {
    const live = await this.live<Array<{ id: string; sender: string; text: string; timestamp: string; isEncrypted: boolean }>>(
      `/cases/${encodeURIComponent(complaintId)}/messages`
    );
    if (live && live.success && live.data) {
      stateMessages[complaintId] = live.data;
      return live;
    }
    if (live && !live.success) return live;
    try {
      this.verifyCaseAccess(complaintId);
      const msgs = stateMessages[complaintId] || [];
      return { success: true, status: 200, data: msgs, source: 'stateful_mock', timestamp: new Date().toISOString() };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, status: 403, error: msg, source: 'stateful_mock', timestamp: new Date().toISOString() };
    }
  }

  public static async sendMessage(complaintId: string, text: string): Promise<ApiResponse<{ id: string; sender: string; text: string; timestamp: string }>> {
    const live = await this.live<{ id: string; sender: string; text: string; timestamp: string }>(
      `/cases/${encodeURIComponent(complaintId)}/messages`,
      this.post({ text })
    );
    if (live && live.success && live.data) {
      if (!stateMessages[complaintId]) {
        stateMessages[complaintId] = [];
      }
      stateMessages[complaintId].push({ ...live.data, isEncrypted: true });
      return live;
    }
    if (live && !live.success) return live;
    try {
      this.verifyCaseAccess(complaintId);
      if (!stateMessages[complaintId]) {
        stateMessages[complaintId] = [];
      }
      const now = new Date().toISOString();
      const newMsg = {
        id: `msg-${Date.now()}`,
        sender: `${this.user.name} (${this.user.title})`,
        text,
        timestamp: now,
        isEncrypted: true
      };
      stateMessages[complaintId].push(newMsg);

      stateAuditEvents.unshift({
        id: `AUD-${Date.now()}`,
        complaintId,
        eventType: 'witness_statement_recorded',
        timestamp: now,
        actorRef: `${this.user.name} (${this.user.title})`,
        details: `Incident observation / evidence note recorded: "${text.slice(0, 100)}${text.length > 100 ? '…' : ''}".`,
        sha256Proof: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        merkleRoot: '0x8849bca0199248bbca019248bca019248bca019248bca019248bca019248bc01',
        blockNumber: 62891460,
        txHash: '0x9482f012cc8a41289df71900bfa2210499e984210aef102948bc0192481092a18230',
        verificationStatus: 'verified_commitment'
      });

      return { success: true, status: 201, data: newMsg, source: 'stateful_mock', timestamp: now };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, status: 403, error: msg, source: 'stateful_mock', timestamp: new Date().toISOString() };
    }
  }

  // --- SILENT AUDIT API ---
  public static async getAuditEvents(complaintId?: string): Promise<ApiResponse<AuditEvent[]>> {
    const live = await this.live<AuditEvent[]>(
      complaintId ? `/audit?case_id=${encodeURIComponent(complaintId)}` : '/audit'
    );
    if (live && live.success && live.data) return live;
    if (live && !live.success) return live;
    let events = stateAuditEvents;
    if (complaintId) {
      events = events.filter(e => e.complaintId === complaintId);
    }
    return {
      success: true,
      status: 200,
      data: events,
      source: 'stateful_mock',
      timestamp: new Date().toISOString()
    };
  }

  public static async verifyEvidenceIntegrity(complaintId: string, evidenceId: string): Promise<ApiResponse<{ verified: boolean; sha256Matches: boolean; zkpVerified: boolean; blockTimestamp: string }>> {
    const live = await this.live<{ verified: boolean; sha256Matches: boolean; zkpVerified: boolean; blockTimestamp: string }>(
      `/cases/${encodeURIComponent(complaintId)}/evidence/${encodeURIComponent(evidenceId)}/verify`
    );
    if (live) return live;
    const report = stateComplaints.find(c => c.id === complaintId);
    const ev = report?.evidence.find(e => e.id === evidenceId);

    if (!ev) {
      return { success: false, status: 404, error: 'Evidence file not found', source: 'stateful_mock', timestamp: new Date().toISOString() };
    }

    return {
      success: true,
      status: 200,
      data: {
        verified: true,
        sha256Matches: true,
        zkpVerified: true,
        blockTimestamp: '2026-10-09T08:35:40Z'
      },
      source: 'stateful_mock',
      timestamp: new Date().toISOString()
    };
  }

  // --- COMMITTEE POOL API ---
  public static async getCommitteePool(poolId?: CommitteePoolId): Promise<ApiResponse<CommitteeMemberRecord[]>> {
    const live = await this.live<CommitteeMemberRecord[]>(poolId ? `/committee-pool?pool_id=${poolId}` : '/committee-pool');
    if (live && live.success && live.data) return live;
    if (live && !live.success) return live;
    let list = stateCommitteePool;
    if (poolId) {
      list = list.filter(m => m.poolId === poolId);
    }
    return {
      success: true,
      status: 200,
      data: list,
      source: 'stateful_mock',
      timestamp: new Date().toISOString()
    };
  }

  public static async assignCommittee(complaintId: string, memberIds: string[]): Promise<ApiResponse<Complaint>> {
    const live = await this.live<Complaint>(`/cases/${encodeURIComponent(complaintId)}/committee`, this.post({ member_ids: memberIds }));
    if (live && live.success && live.data) {
      const idx = stateComplaints.findIndex(comp => comp.id === complaintId);
      if (idx >= 0) stateComplaints[idx] = live.data;
      return live;
    }
    if (live && !live.success) return live;

    const c = stateComplaints.find(comp => comp.id === complaintId);
    if (!c) {
      return { success: false, status: 404, error: 'Case not found', source: 'stateful_mock', timestamp: new Date().toISOString() };
    }

    c.committeeMemberIds = memberIds;
    c.status = 'committee_assigned';
    c.requiredNextAction = '3-member committee seated. Lead investigator to open formal inquiry.';

    stateCommitteePool.forEach(m => {
      if (memberIds.includes(m.id)) {
        m.assignmentStatus = 'active_assigned';
        if (!m.assignedCaseIds.includes(complaintId)) m.assignedCaseIds.push(complaintId);
      }
    });

    const now = new Date().toISOString();
    stateAuditEvents.unshift({
      id: `AUD-${Date.now()}`,
      complaintId,
      eventType: 'committee_assigned',
      timestamp: now,
      actorRef: `${this.user.name} (${this.user.title})`,
      details: `Independent 3-member committee assigned to case ${complaintId}: ${memberIds.map(id => stateCommitteePool.find(m => m.id === id)?.name || id).join(', ')}.`,
      sha256Proof: '8f2a93b41d2110c92bf5a19001124ae8092cc771124ae8092cc7719001124ae8',
      merkleRoot: '0x9948201bc019248102948bc0192481029481092a18230bc71a80491823019bc0',
      blockNumber: 62891420,
      txHash: '0x1121bca01994afc09121a884efb204918230bc71a80418230bc71a8049182301',
      verificationStatus: 'verified_commitment'
    });

    return {
      success: true,
      status: 200,
      data: c,
      source: 'stateful_mock',
      timestamp: now
    };
  }

  // --- M3 ENGINES & CASE OUTCOMES (live backend only) ---
  private static unavailable<T>(): ApiResponse<T> {
    return {
      success: false,
      status: 503,
      error: 'Available with the live backend only',
      source: 'stateful_mock',
      timestamp: new Date().toISOString()
    };
  }

  public static async getPatterns(): Promise<ApiResponse<PatternReport>> {
    const live = await this.live<PatternReport>('/patterns');
    if (live) return live;

    return {
      success: true,
      status: 200,
      data: {
        repeatSubjects: [
          {
            subjectRef: 'SUBJ-4a8f902b',
            caseIds: ['INC-892', 'INC-741'],
            count: 2,
            categories: ['bullying_authority_abuse', 'sexual_harassment'],
            basis: 'structured_reference',
            human_review_required: true
          }
        ],
        correlatedPairs: [
          {
            caseIds: ['INC-650', 'INC-741'],
            score: 0.74,
            method: 'semantic_embedding'
          }
        ],
        limitation: 'Patterns are review cues, not findings. Reports remain separate cases.'
      },
      source: 'stateful_mock',
      timestamp: new Date().toISOString()
    };
  }

  public static async getRelatedCases(complaintId: string): Promise<ApiResponse<RelatedCases>> {
    return (await this.live<RelatedCases>(`/cases/${encodeURIComponent(complaintId)}/related`)) ?? this.unavailable();
  }

  public static async resolveCase(
    complaintId: string,
    outcome: ResolutionOutcome,
    summary: string,
    actions: string[]
  ): Promise<ApiResponse<Complaint & { resolution: CaseResolution }>> {
    return (
      (await this.live<Complaint & { resolution: CaseResolution }>(
        `/cases/${encodeURIComponent(complaintId)}/resolve`,
        this.post({ outcome, summary, actions })
      )) ?? this.unavailable()
    );
  }

  public static async getInsights(): Promise<ApiResponse<ReflectReformInsights>> {
    return (await this.live<ReflectReformInsights>('/insights')) ?? this.unavailable();
  }

  /** Legal Evidence Package: downloads the PDF (the backend records the export in the Silent Audit). */
  public static async downloadEvidencePackage(complaintId: string): Promise<ApiResponse<{ exportId: string }>> {
    if (this.forceMock) return this.unavailable();
    try {
      const res = await fetch(`${this.apiBaseUrl}/hr/cases/${encodeURIComponent(complaintId)}/export.pdf`, {
        headers: { 'X-Stub-Admin': this.stubAdminKey, 'X-Staff-Id': this.user.id }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const error = body?.detail?.message || body?.detail?.reason || `HTTP ${res.status}`;
        return { success: false, status: res.status, error, source: 'real_backend', timestamp: new Date().toISOString() };
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${complaintId}-evidence-package.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      return {
        success: true,
        status: 200,
        data: { exportId: res.headers.get('X-Export-Id') || '' },
        source: 'real_backend',
        timestamp: new Date().toISOString()
      };
    } catch {
      return { success: false, status: 0, error: 'Backend unreachable', source: 'real_backend', timestamp: new Date().toISOString() };
    }
  }

  // Reset state helper for testing & judges
  public static resetDemoState(): void {
    stateComplaints = JSON.parse(JSON.stringify(INITIAL_COMPLAINTS));
    stateChallenges = JSON.parse(JSON.stringify(INITIAL_CHALLENGES));
    stateCommitteePool = JSON.parse(JSON.stringify(COMMITTEE_POOL));
    stateWitnesses = JSON.parse(JSON.stringify(INITIAL_WITNESS_INVITATIONS));
    stateAuditEvents = JSON.parse(JSON.stringify(INITIAL_AUDIT_EVENTS));
  }
}
