export type EventMomentType = 'CIVIL' | 'RELIGIOUS' | 'ALAMBAMENTO' | 'RECEPTION' | 'CUSTOM';
export type ProjectKind = 'WEDDING' | 'ALAMBAMENTO' | 'PARTY' | 'OTHER';
export type ProjectMemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'WAITING' | 'DONE';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type ExpenseStatus = 'ESTIMATED' | 'COMMITTED' | 'PAID';

export interface ProjectSummary {
  id: string;
  title: string;
  kind: ProjectKind;
  date: string | null;
  province: string | null;
  currency: 'AOA';
  budgetLimit?: number | string | null;
  guestEstimate?: number | null;
  archivedAt?: string | null;
  currentRole?: ProjectMemberRole;
}

export interface CreateProjectInput {
  title: string;
  kind: ProjectKind;
  date?: string;
  province?: string;
}
