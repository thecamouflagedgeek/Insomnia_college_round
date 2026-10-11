import { Complaint } from '../types/complaint';
import { CommitteeChallenge, CommitteeMemberRecord } from '../types/committee';
import { WitnessInvitation } from '../types/witness';
import { AuditEvent } from '../types/audit';

export const INITIAL_COMPLAINTS: Complaint[] = [
  {
    id: 'INC-892',
    anonymousToken: 'ZK-ANON-9014-X8',
    category: 'bullying_authority_abuse',
    severity: 'critical',
    status: 'under_challenge',
    title: 'Repeated Retaliation and Rating Downgrade Post-Safety Disclosure',
    summary: 'Reporting manager systematically stripped project responsibilities, scheduled punitive isolation reviews, and threatened immigration sponsorship status following disclosure of safety audit manipulation in Operations.',
    submittedAt: '2026-10-09T08:30:00Z',
    departmentScope: 'Global Operations & Logistics',
    assignedInvestigatorId: 'usr_elena',
    committeeMemberIds: ['usr_marcus', 'usr_david'], // Marcus is challenged!
    revokedMemberIds: [],
    activeChallengeId: 'CH-104',
    evidence: [
      {
        id: 'ev-892-1',
        name: 'redacted_performance_overrides_q3.pdf',
        size: '2.4 MB',
        mimeType: 'application/pdf',
        sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        zkpCommitment: '0x8f2a93b41d2110c92bf5a19001124ae8092cc771',
        uploadTimestamp: '2026-10-09T08:32:15Z',
        verificationStatus: 'verified',
        storagePath: 'vault/secure-cases/INC-892/ev-1.enc'
      },
      {
        id: 'ev-892-2',
        name: 'secure_chat_export_signed_logs.json',
        size: '480 KB',
        mimeType: 'application/json',
        sha256Hash: '4a6b22194d3e8e1248086202c4b22c2a4980bb66971fcb4e39a55225ef6eb792',
        zkpCommitment: '0x33b190f892a013c7104b901a8820c4e8912ef718',
        uploadTimestamp: '2026-10-09T08:35:40Z',
        verificationStatus: 'verified',
        storagePath: 'vault/secure-cases/INC-892/ev-2.enc'
      }
    ],
    blockchainSealTx: '0x9482f012cc8a41289df71900bfa2210499e984210aef',
    zkpNullifierHash: '0x1904bbca418023190afb201199a4c8109',
    witnessQuorumActive: true,
    requiredNextAction: 'Independent Ombudsperson review of supervisory conflict challenge #CH-104.'
  },
  {
    id: 'INC-741',
    anonymousToken: 'ZK-ANON-4122-M1',
    category: 'sexual_harassment',
    severity: 'critical',
    status: 'investigation_active',
    title: 'Persistent Inappropriate Advances and Promotion Coercion',
    summary: 'Senior director repeatedly made unsolicited advances during off-site symposium and linked executive sponsorship for upcoming promotion committee to compliance.',
    submittedAt: '2026-10-05T14:15:00Z',
    departmentScope: 'Executive Strategy & BD',
    assignedInvestigatorId: 'usr_elena',
    committeeMemberIds: ['usr_david', 'usr_maya'],
    revokedMemberIds: [],
    activeChallengeId: 'CH-102',
    evidence: [
      {
        id: 'ev-741-1',
        name: 'sms_timestamps_certified.pdf',
        size: '1.1 MB',
        mimeType: 'application/pdf',
        sha256Hash: '8b7d904b321a998fe11b22049e01bc49a90bb67104ae321908bf43219aa48021',
        zkpCommitment: '0x4421b9a4c80112ef093a1288c1a902bf41203ca9',
        uploadTimestamp: '2026-10-05T14:20:00Z',
        verificationStatus: 'verified',
        storagePath: 'vault/secure-cases/INC-741/ev-1.enc'
      }
    ],
    blockchainSealTx: '0x5512bca01994afc09121a884efb204918230bc71a804',
    zkpNullifierHash: '0x4990cba190014bf99214a802911bca09',
    witnessQuorumActive: true,
    requiredNextAction: 'Investigator witness interview quorum compilation.'
  },
  {
    id: 'INC-650',
    anonymousToken: 'ZK-ANON-7833-K9',
    category: 'discrimination',
    severity: 'high',
    status: 'committee_assigned',
    title: 'Systemic Exclusion in Compensation Bands and Promotion Velocity',
    summary: 'Documentation showing minority engineers systematically clustered in lower compensation tier bands despite equivalent tenure and superior peer review distributions.',
    submittedAt: '2026-10-02T11:00:00Z',
    departmentScope: 'Cloud Infrastructure Group',
    assignedInvestigatorId: 'usr_elena',
    committeeMemberIds: ['usr_rachel', 'usr_carlos'],
    revokedMemberIds: [],
    evidence: [
      {
        id: 'ev-650-1',
        name: 'anonymized_salary_band_deviations.csv',
        size: '620 KB',
        mimeType: 'text/csv',
        sha256Hash: '1904a88bc4120aefb9021cbb89012a4f00912384a8bc129402948bbca1004128',
        zkpCommitment: '0x129038baef1092a4bc00192a838190cba9210048',
        uploadTimestamp: '2026-10-02T11:05:00Z',
        verificationStatus: 'verified',
        storagePath: 'vault/secure-cases/INC-650/ev-1.enc'
      }
    ],
    blockchainSealTx: '0x33108ba1940bc201488102948bc0991aef80231bca02',
    zkpNullifierHash: '0x884019ba400192ca488190203a9810bb',
    witnessQuorumActive: false,
    requiredNextAction: 'Initial review of statistical evidence anomalies.'
  },
  {
    id: 'INC-512',
    anonymousToken: 'ZK-ANON-3091-B4',
    category: 'whistleblowing_bribery',
    severity: 'high',
    status: 'investigation_active',
    title: 'Vendor Procurement Kickback and Subcontracting Manipulation',
    summary: 'Procurement manager established shell consulting entity to capture non-competitive hardware procurement contracts totaling $1.2M.',
    submittedAt: '2026-09-28T16:45:00Z',
    departmentScope: 'Global Procurement',
    assignedInvestigatorId: 'usr_elena',
    committeeMemberIds: ['usr_david', 'usr_tariq'],
    revokedMemberIds: [],
    evidence: [
      {
        id: 'ev-512-1',
        name: 'bank_wire_routing_subcontracts.pdf',
        size: '3.8 MB',
        mimeType: 'application/pdf',
        sha256Hash: '99201ba84910248bc01129481a8bc09281a8c019248bbca019248bc091823019',
        zkpCommitment: '0x88301948201bca0991823019bc0192481092bb41',
        uploadTimestamp: '2026-09-28T16:50:00Z',
        verificationStatus: 'verified',
        storagePath: 'vault/secure-cases/INC-512/ev-1.enc'
      }
    ],
    blockchainSealTx: '0x77102948102bc01948201948bc019248102948bc0192',
    zkpNullifierHash: '0x330192481092bc019248102948bc0192',
    witnessQuorumActive: false,
    requiredNextAction: 'Forensic audit cross-referencing vendor tax IDs.'
  }
];

export const INITIAL_CHALLENGES: CommitteeChallenge[] = [
  {
    id: 'CH-104',
    complaintId: 'INC-892',
    complaintTitle: 'Repeated Retaliation and Rating Downgrade Post-Safety Disclosure',
    poolId: 'whistleblowing_ethics',
    challengedMemberId: 'usr_marcus',
    challengedMemberName: 'Marcus Vance',
    challengedMemberRole: 'VP of Engineering Operations (Committee Member)',
    conflictCategory: 'hierarchy_direct',
    conflictDetails: 'Marcus Vance is the direct skip-level manager of the accused party and directly oversees the departmental bonus pool cited in the alleged retaliation scheme. Appointing him to the adjudicating committee creates an insurmountable conflict of interest.',
    submittedAt: '2026-10-09T10:14:00Z',
    status: 'pending_independent_review',
    independentReviewerId: 'usr_aris', // Dr. Aris Thorne
    blockchainVerificationTx: '0x9948201bc019248102948bc0192481029481092a'
  },
  {
    id: 'CH-102',
    complaintId: 'INC-741',
    complaintTitle: 'Persistent Inappropriate Advances and Promotion Coercion',
    poolId: 'posh_harassment',
    challengedMemberId: 'usr_jonathan',
    challengedMemberName: 'Jonathan Ross',
    challengedMemberRole: 'Director of BD (Committee Member)',
    conflictCategory: 'personal_relationship',
    conflictDetails: 'Jonathan Ross has an acknowledged close personal and social relationship with the respondent Director named in the complaint. Recusal requested under POSH Act procedural neutrality mandates.',
    submittedAt: '2026-10-06T11:20:00Z',
    status: 'pending_independent_review',
    independentReviewerId: 'usr_aris',
    blockchainVerificationTx: '0x4421bca9012a488190203a9810bb1904bbca4180'
  }
];

export const COMMITTEE_POOL: CommitteeMemberRecord[] = [
  // --- Whistleblowing & Ethics Pool ---
  {
    id: 'usr_marcus',
    name: 'Marcus Vance',
    email: 'm.vance@incognito.org',
    roleTitle: 'VP of Engineering Operations',
    department: 'Engineering Operations',
    poolId: 'whistleblowing_ethics',
    currentWorkload: 2,
    conflictRiskLevel: 'high',
    isEligible: false,
    assignedCaseIds: ['INC-892'],
    assignmentStatus: 'challenged'
  },
  {
    id: 'usr_david',
    name: 'David Kim',
    email: 'd.kim@incognito.org',
    roleTitle: 'Associate General Counsel (Labor)',
    department: 'Legal Counsel',
    poolId: 'whistleblowing_ethics',
    currentWorkload: 3,
    conflictRiskLevel: 'none',
    isEligible: true,
    assignedCaseIds: ['INC-892', 'INC-512'],
    assignmentStatus: 'active_assigned'
  },
  {
    id: 'usr_priya',
    name: 'Priya Sundaram',
    email: 'p.sundaram@incognito.org',
    roleTitle: 'Senior Director of People Relations',
    department: 'HR Global',
    poolId: 'whistleblowing_ethics',
    currentWorkload: 1,
    conflictRiskLevel: 'none',
    isEligible: true,
    assignedCaseIds: [],
    assignmentStatus: 'available'
  },
  {
    id: 'usr_tariq',
    name: 'Tariq Mansoor',
    email: 't.mansoor@incognito.org',
    roleTitle: 'Chief Compliance & Integrity Officer',
    department: 'Ethics & Compliance',
    poolId: 'whistleblowing_ethics',
    currentWorkload: 2,
    conflictRiskLevel: 'low',
    isEligible: true,
    assignedCaseIds: ['INC-512'],
    assignmentStatus: 'active_assigned'
  },

  // --- POSH / Sexual Harassment Pool ---
  {
    id: 'usr_maya',
    name: 'Dr. Maya Lin',
    email: 'm.lin@incognito.org',
    roleTitle: 'Presiding Officer (Internal Committee)',
    department: 'People Operations',
    poolId: 'posh_harassment',
    currentWorkload: 2,
    conflictRiskLevel: 'none',
    isEligible: true,
    assignedCaseIds: ['INC-741'],
    assignmentStatus: 'active_assigned'
  },
  {
    id: 'usr_jonathan',
    name: 'Jonathan Ross',
    email: 'j.ross@incognito.org',
    roleTitle: 'Director of Business Development',
    department: 'Executive BD',
    poolId: 'posh_harassment',
    currentWorkload: 1,
    conflictRiskLevel: 'high',
    isEligible: false,
    assignedCaseIds: ['INC-741'],
    assignmentStatus: 'challenged'
  },
  {
    id: 'usr_meera',
    name: 'Advocate Meera Deshmukh',
    email: 'm.deshmukh@legal-counsel.org',
    roleTitle: 'External Legal Member (POSH Specialist)',
    department: 'External Statutory Panel',
    poolId: 'posh_harassment',
    currentWorkload: 1,
    conflictRiskLevel: 'none',
    isEligible: true,
    assignedCaseIds: [],
    assignmentStatus: 'available'
  },

  // --- Discrimination & Inclusion Pool ---
  {
    id: 'usr_rachel',
    name: 'Rachel Adams',
    email: 'r.adams@incognito.org',
    roleTitle: 'Global Head of Diversity & Inclusion',
    department: 'D&I Directorate',
    poolId: 'discrimination_inclusion',
    currentWorkload: 1,
    conflictRiskLevel: 'none',
    isEligible: true,
    assignedCaseIds: ['INC-650'],
    assignmentStatus: 'active_assigned'
  },
  {
    id: 'usr_carlos',
    name: 'Carlos Mendoza',
    email: 'c.mendoza@incognito.org',
    roleTitle: 'Lead Compensation & Equity Analyst',
    department: 'Total Rewards',
    poolId: 'discrimination_inclusion',
    currentWorkload: 2,
    conflictRiskLevel: 'none',
    isEligible: true,
    assignedCaseIds: ['INC-650'],
    assignmentStatus: 'active_assigned'
  },
  {
    id: 'usr_fatima',
    name: 'Fatima Al-Hassan',
    email: 'f.alhassan@incognito.org',
    roleTitle: 'Senior Labor Relations Director',
    department: 'Employee Relations',
    poolId: 'discrimination_inclusion',
    currentWorkload: 0,
    conflictRiskLevel: 'none',
    isEligible: true,
    assignedCaseIds: [],
    assignmentStatus: 'available'
  },

  // --- General Workplace Conduct Pool ---
  {
    id: 'usr_kenneth',
    name: 'Kenneth Cole',
    email: 'k.cole@incognito.org',
    roleTitle: 'Director of Workplace Conflict Resolution',
    department: 'People & Culture',
    poolId: 'workplace_conduct',
    currentWorkload: 1,
    conflictRiskLevel: 'none',
    isEligible: true,
    assignedCaseIds: [],
    assignmentStatus: 'available'
  },
  {
    id: 'usr_sandra',
    name: 'Sandra Bullock-Lee',
    email: 's.lee@incognito.org',
    roleTitle: 'Senior Investigator (People Relations)',
    department: 'Ethics Unit',
    poolId: 'workplace_conduct',
    currentWorkload: 2,
    conflictRiskLevel: 'none',
    isEligible: true,
    assignedCaseIds: [],
    assignmentStatus: 'available'
  },

  // --- Independent Review Panel ---
  {
    id: 'usr_aris',
    name: 'Dr. Aris Thorne',
    email: 'a.thorne@ombuds-independent.org',
    roleTitle: 'Independent Ombudsperson & Challenge Adjudicator',
    department: 'External Oversight Panel',
    poolId: 'independent_review',
    currentWorkload: 2,
    conflictRiskLevel: 'none',
    isEligible: true,
    assignedCaseIds: [],
    assignmentStatus: 'active_assigned'
  },
  {
    id: 'usr_arthur',
    name: 'Hon. Arthur Vance (Retd.)',
    email: 'a.vance@appellate-review.org',
    roleTitle: 'Senior Appellate Ombuds Counsel',
    department: 'External Review Board',
    poolId: 'independent_review',
    currentWorkload: 0,
    conflictRiskLevel: 'none',
    isEligible: true,
    assignedCaseIds: [],
    assignmentStatus: 'available'
  }
];

export const INITIAL_WITNESS_INVITATIONS: WitnessInvitation[] = [
  {
    id: 'WIT-01',
    complaintId: 'INC-892',
    anonymousAlias: 'Witness Alpha (Operations Lead)',
    invitedAt: '2026-10-09T11:00:00Z',
    status: 'accepted',
    respondedAt: '2026-10-09T14:22:00Z',
    statementProvided: true,
    statementLengthWords: 340,
    encryptedStatementRef: 'vault/witnesses/INC-892/wit-01-enc.gpg'
  },
  {
    id: 'WIT-02',
    complaintId: 'INC-892',
    anonymousAlias: 'Witness Beta (Staff Systems Engineer)',
    invitedAt: '2026-10-09T11:05:00Z',
    status: 'accepted',
    respondedAt: '2026-10-09T16:45:00Z',
    statementProvided: true,
    statementLengthWords: 215,
    encryptedStatementRef: 'vault/witnesses/INC-892/wit-02-enc.gpg'
  },
  {
    id: 'WIT-03',
    complaintId: 'INC-892',
    anonymousAlias: 'Witness Gamma (Staff Project Coordinator)',
    invitedAt: '2026-10-09T11:10:00Z',
    status: 'pending',
    statementProvided: false
  },
  {
    id: 'WIT-04',
    complaintId: 'INC-892',
    anonymousAlias: 'Witness Delta (Logistics Analyst)',
    invitedAt: '2026-10-09T11:15:00Z',
    status: 'declined',
    respondedAt: '2026-10-09T13:10:00Z',
    statementProvided: false
  },
  {
    id: 'WIT-05',
    complaintId: 'INC-741',
    anonymousAlias: 'Witness Epsilon (Strategy Director)',
    invitedAt: '2026-10-06T09:30:00Z',
    status: 'accepted',
    respondedAt: '2026-10-06T14:10:00Z',
    statementProvided: true,
    statementLengthWords: 280,
    encryptedStatementRef: 'vault/witnesses/INC-741/wit-05-enc.gpg'
  },
  {
    id: 'WIT-06',
    complaintId: 'INC-741',
    anonymousAlias: 'Witness Zeta (Senior Events Coordinator)',
    invitedAt: '2026-10-06T10:00:00Z',
    status: 'accepted',
    respondedAt: '2026-10-06T16:30:00Z',
    statementProvided: true,
    statementLengthWords: 195,
    encryptedStatementRef: 'vault/witnesses/INC-741/wit-06-enc.gpg'
  },
  {
    id: 'WIT-07',
    complaintId: 'INC-741',
    anonymousAlias: 'Witness Eta (Associate Partner)',
    invitedAt: '2026-10-06T11:15:00Z',
    status: 'pending',
    statementProvided: false
  },
  {
    id: 'WIT-08',
    complaintId: 'INC-650',
    anonymousAlias: 'Witness Theta (Principal Systems Architect)',
    invitedAt: '2026-10-03T10:15:00Z',
    status: 'accepted',
    respondedAt: '2026-10-03T15:20:00Z',
    statementProvided: true,
    statementLengthWords: 410,
    encryptedStatementRef: 'vault/witnesses/INC-650/wit-08-enc.gpg'
  },
  {
    id: 'WIT-09',
    complaintId: 'INC-650',
    anonymousAlias: 'Witness Iota (Staff Reliability Engineer)',
    invitedAt: '2026-10-03T11:00:00Z',
    status: 'accepted',
    respondedAt: '2026-10-03T17:40:00Z',
    statementProvided: true,
    statementLengthWords: 230,
    encryptedStatementRef: 'vault/witnesses/INC-650/wit-09-enc.gpg'
  }
];

export const INITIAL_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'AUD-901',
    complaintId: 'INC-892',
    eventType: 'complaint_sealed_zkp',
    timestamp: '2026-10-09T08:30:12Z',
    actorRef: 'Anonymous Employee [ZK-Proof #4912]',
    details: 'Complaint successfully sealed using client-side zero-knowledge proof. Identity commitment pinned to Polygon PoS contract 0x718a...229.',
    sha256Proof: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    merkleRoot: '0x8849bca0199248bbca019248bca019248bca019248bca019248bca019248bc01',
    blockNumber: 62891044,
    txHash: '0x9482f012cc8a41289df71900bfa2210499e984210aef',
    verificationStatus: 'verified_commitment'
  },
  {
    id: 'AUD-902',
    complaintId: 'INC-892',
    eventType: 'committee_assigned',
    timestamp: '2026-10-09T09:00:00Z',
    actorRef: 'HR Review Lead (Sarah Jenkins)',
    details: 'Initial review committee constituted with members: Marcus Vance (VP Ops), David Kim (Legal).',
    sha256Proof: 'cb844fc2d6b548408e41952c2cf42f026fb966f97ef7ee94b3c9b6343e061845',
    merkleRoot: '0x8849bca0199248bbca019248bca019248bca019248bca019248bca019248bc01',
    blockNumber: 62891120,
    txHash: '0x22104918230bc71a80491823019bc0192481092bb41019248bca019248bc0192',
    verificationStatus: 'verified_commitment'
  },
  {
    id: 'AUD-903',
    complaintId: 'INC-892',
    eventType: 'committee_challenged',
    timestamp: '2026-10-09T10:14:00Z',
    actorRef: 'Anonymous Employee [ZK-Proof #4912]',
    details: 'Formal Committee Challenge #CH-104 lodged against Marcus Vance citing direct reporting hierarchy and supervisory conflict. Challenge locked for independent adjudication.',
    sha256Proof: 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3',
    merkleRoot: '0x8849bca0199248bbca019248bca019248bca019248bca019248bca019248bc01',
    blockNumber: 62891305,
    txHash: '0x9948201bc019248102948bc0192481029481092a18230bc71a80491823019bc0',
    verificationStatus: 'verified_commitment'
  }
];
