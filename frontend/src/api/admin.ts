import http from "./http";
import type { AdminList, AdminOverview, AdminPeriod, AdminUser, AdminUserUpdateForm } from "../types/admin";

export async function fetchAdminOverview(period: AdminPeriod = "week"): Promise<AdminOverview> {
  const { data } = await http.get<{ overview: AdminOverview }>("/admin/overview", { params: { period } });
  return data.overview;
}

export async function fetchAdminUsers(params?: {
  department?: string;
  status?: string;
}): Promise<AdminList> {
  const { data } = await http.get<AdminList>("/admin/users", { params });
  return data;
}

export async function fetchAdminUser(userId: number): Promise<AdminUser> {
  const { data } = await http.get<{ user: AdminUser }>(`/admin/users/${userId}`);
  return data.user;
}

export async function updateAdminUser(userId: number, form: AdminUserUpdateForm): Promise<AdminUser> {
  const { data } = await http.put<{ user: AdminUser }>(`/admin/users/${userId}`, form);
  return data.user;
}
