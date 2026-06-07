export const COLLECTIONS = {
  users: 'users',
  memberPlans: 'member_plans',
  memberships: 'memberships',
  orders: 'orders',
  inviteRelations: 'invite_relations',
  pointsLedger: 'points_ledger',
  emailVerificationCodes: 'email_verification_codes',
  appstoreEmailVerificationCodes: 'appstore_email_verification_codes',
  appstoreAccounts: 'appstore_accounts',
  aiNews: 'ai_news',
  deliveries: 'deliveries',
  reminderLogs: 'reminder_logs',
  auditLogs: 'audit_logs',
} as const;

export const SUCCESS_CODE = 0;
export const DEFAULT_PRODUCT_CODE = 'ai_news';
export const DEFAULT_PRODUCT_NAME = 'Open AI 资讯会员';
