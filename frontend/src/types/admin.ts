import type { Work } from "./dashboard";

export type AdminPeriod = "week" | "month" | "all";

export type AdminUserStatus = "active" | "inactive" | "new";

export interface AdminOverview {
  period: AdminPeriod;
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  usersWithRecords: number;
  adoptionRate: number;
  checkInRate: number;
  inactiveUsers: number;
}

export interface AdminUser {
  userId: number;
  username: string;
  userName: string;
  department: string | null;
  team: string | null;
  position: string | null;
  role: "USER" | "ADMIN";
  createdAt: string;
  lastActivityDate: string | null;
  weekDays: number;
  totalRecords: number;
  status: AdminUserStatus;
  weekRecords: Work[];
}

export interface AdminList {
  weekStart: string;
  weekEnd: string;
  users: AdminUser[];
}

export interface AdminUserUpdateForm {
  userName: string;
  department: string;
  team: string;
  position: string;
  role: "USER" | "ADMIN";
}
