// Generated from contract/backend.json (pulse-backend qa/map). Do not edit; re-pin by syncing the contract.

export const UserRole = ["INVENTOR", "TECH_COMMITTEE", "LEGAL_COUNSEL", "CASE_OWNER", "PHOTON_ADMIN", "PHOTON_SUPERADMIN"] as const;
export type UserRole = (typeof UserRole)[number];
export const AccessKind = ["ASSIGNMENT", "TEMPORARY", "STEP_IN"] as const;
export type AccessKind = (typeof AccessKind)[number];
export const UserStatus = ["INVITED", "ACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof UserStatus)[number];
export const AuthProvider = ["PASSWORD", "GOOGLE", "MICROSOFT", "SAML"] as const;
export type AuthProvider = (typeof AuthProvider)[number];
export const InviteStatus = ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"] as const;
export type InviteStatus = (typeof InviteStatus)[number];
export const AuditAction = ["SIGNUP_SUCCEEDED", "SIGNUP_REJECTED_DOMAIN", "LOGIN_SUCCEEDED", "LOGIN_FAILED", "LOGOUT", "PASSWORD_RESET_REQUESTED", "PASSWORD_RESET_COMPLETED", "INVITE_CREATED", "INVITE_ACCEPTED", "INVITE_REVOKED", "USER_ROLE_CHANGED", "USER_SUSPENDED", "USER_REACTIVATED", "CLIENT_ACCESS_GRANTED", "CLIENT_ACCESS_REVOKED", "CLIENT_ACCESS_EXPIRED", "PHOTON_ADMIN_ACCESS", "CLIENT_CREATED", "CLIENT_UPDATED", "PATENTS_IMPORTED", "PATENT_DELETED", "PATENT_RESTORED"] as const;
export type AuditAction = (typeof AuditAction)[number];
export const IdeaState = ["DRAFT", "TECH_REVIEW", "LEGAL_REVIEW", "CHANGES_REQUESTED", "REJECTED", "SENT_TO_PHOTON", "FILED"] as const;
export type IdeaState = (typeof IdeaState)[number];
export const InventorRole = ["PRIMARY", "CO"] as const;
export type InventorRole = (typeof InventorRole)[number];
export const ReviewStage = ["TECHNICAL", "LEGAL"] as const;
export type ReviewStage = (typeof ReviewStage)[number];
export const ReviewDecision = ["APPROVED", "CHANGES_REQUESTED", "REJECTED"] as const;
export type ReviewDecision = (typeof ReviewDecision)[number];
export const PatentStatus = ["APPLIED", "EXAMINATION", "GRANTED", "EXPIRED", "WITHDRAWN", "REJECTED", "ABANDONED", "NONPAYMENT"] as const;
export type PatentStatus = (typeof PatentStatus)[number];
export const DueDateStatus = ["PENDING", "COMPLETED", "MISSED"] as const;
export type DueDateStatus = (typeof DueDateStatus)[number];
export const ActionStatus = ["NO_ACTION", "NEW", "ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED", "DECLINED"] as const;
export type ActionStatus = (typeof ActionStatus)[number];
export const ActionSubmissionState = ["DRAFT", "SUBMITTED", "UPDATED"] as const;
export type ActionSubmissionState = (typeof ActionSubmissionState)[number];
export const ClientType = ["EXISTING", "POTENTIAL"] as const;
export type ClientType = (typeof ClientType)[number];
export const ClientPlan = ["FREE", "ENTERPRISE", "PRODUCT_OWNER"] as const;
export type ClientPlan = (typeof ClientPlan)[number];
export const ImportStatus = ["RUNNING", "PARTIAL", "COMPLETED", "FAILED"] as const;
export type ImportStatus = (typeof ImportStatus)[number];
export const FileStatus = ["PENDING", "STORED"] as const;
export type FileStatus = (typeof FileStatus)[number];

export const ROLES = ["INVENTOR", "TECH_COMMITTEE", "LEGAL_COUNSEL", "CASE_OWNER", "PHOTON_ADMIN", "PHOTON_SUPERADMIN"] as const;
export type RoleName = (typeof ROLES)[number];
export const GRANTS: Record<RoleName, readonly string[]> = {
  "INVENTOR": [
    "idea:create",
    "idea:read:own",
    "idea:submit",
    "user:read:colleagues",
    "idea:inventors:manage",
    "asset:read"
  ],
  "TECH_COMMITTEE": [
    "idea:read:own",
    "idea:read:client",
    "idea:review:technical",
    "user:read:client",
    "user:read:colleagues",
    "asset:read",
    "docket:read"
  ],
  "LEGAL_COUNSEL": [
    "idea:read:own",
    "idea:read:client",
    "idea:review:legal",
    "idea:send_to_photon",
    "client:configure",
    "user:invite",
    "user:manage",
    "user:read:client",
    "user:read:colleagues",
    "idea:inventors:manage",
    "audit:read",
    "asset:read",
    "asset:write",
    "docket:read"
  ],
  "CASE_OWNER": [
    "idea:read:client",
    "idea:file",
    "client:configure",
    "user:invite",
    "user:read:client",
    "user:read:colleagues",
    "client:read:assigned",
    "asset:read",
    "asset:write",
    "docket:read"
  ],
  "PHOTON_ADMIN": [
    "idea:read:any",
    "idea:file",
    "client:configure",
    "user:invite",
    "user:manage",
    "user:read:client",
    "user:read:colleagues",
    "client:read:any",
    "client:create",
    "access:grant",
    "access:grant:any",
    "audit:read",
    "asset:read",
    "asset:write",
    "docket:read"
  ],
  "PHOTON_SUPERADMIN": [
    "idea:create",
    "idea:read:own",
    "idea:read:client",
    "idea:read:any",
    "idea:submit",
    "idea:review:technical",
    "idea:review:legal",
    "idea:send_to_photon",
    "idea:file",
    "client:configure",
    "user:invite",
    "user:manage",
    "user:read:client",
    "user:read:colleagues",
    "idea:inventors:manage",
    "client:read:assigned",
    "client:read:any",
    "client:create",
    "access:grant",
    "access:grant:any",
    "audit:read",
    "asset:read",
    "asset:write",
    "docket:read"
  ]
};
