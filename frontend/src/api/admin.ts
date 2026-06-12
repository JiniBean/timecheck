import http from "./http";
import type { Overview, Period, UserDetail, UserForm, UserList } from "../types/admin";

export async function fetchOverview(period: Period = "week"): Promise<Overview> {
  const { data } = await http.get<{ overview: Overview }>("/admin/overview", { params: { period } });
  return data.overview;
}

export async function fetchUsers(params?: {
  department?: string;
  status?: string;
}): Promise<UserList> {
  const { data } = await http.get<UserList>("/admin/users", { params });
  return data;
}

export async function fetchUser(userId: number): Promise<UserDetail> {
  const { data } = await http.get<{ user: UserDetail }>(`/admin/users/${userId}`);
  return data.user;
}

export async function updateUser(userId: number, form: UserForm): Promise<UserDetail> {
  const { data } = await http.put<{ user: UserDetail }>(`/admin/users/${userId}`, form);
  return data.user;
}
