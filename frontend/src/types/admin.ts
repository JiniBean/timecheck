import type { Work } from "./dashboard";

export type Period = "week" | "month" | "all";

export type UserStatus = "active" | "inactive" | "new";

export interface Overview {
  period: Period;
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  usersWithRecords: number;
  adoptionRate: number;
  checkInRate: number;
  inactiveUsers: number;
}

export interface UserDetail {
  userId: number;
  username: string;
  name: string;
  department: string | null;
  team: string | null;
  position: string | null;
  role: "USER" | "ADMIN";
  createdAt: string;
  lastActivityDate: string | null;
  weekDays: number;
  totalRecords: number;
  status: UserStatus;
  weekRecords: Work[];
}

export interface UserList {
  weekStart: string;
  weekEnd: string;
  users: UserDetail[];
}

export interface UserForm {
  name: string;
  department: string;
  team: string;
  position: string;
  role: "USER" | "ADMIN";
}
