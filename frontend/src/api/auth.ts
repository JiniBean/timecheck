import axios from "axios";
import http from "./http";
import type { AuthUser, LoginForm, ProfileForm, SignupForm } from "../types/auth";
import { bootError, bootLog } from "../utils/bootLog";

interface AuthResponse {
  user: AuthUser;
}

export async function signup(form: SignupForm): Promise<AuthUser> {
  const { data } = await http.post<AuthResponse>("/auth/signup", {
    username: form.username,
    password: form.password,
    name: form.name,
    department: form.department || null,
    team: form.team || null,
    position: form.position || null
  });
  return data.user;
}

export async function login(form: LoginForm): Promise<AuthUser> {
  const { data } = await http.post<AuthResponse>("/auth/login", form);
  return data.user;
}

export async function logout(): Promise<void> {
  // axios 대신 fetch: 204 No Content / 프록시 응답 파싱 이슈 회피
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: {
      "ngrok-skip-browser-warning": "true"
    }
  });
  bootLog("logout.http", { status: response.status, ok: response.ok });
  if (!response.ok) {
    throw new Error(`logout failed: ${response.status}`);
  }
}

export async function updateMe(form: ProfileForm): Promise<AuthUser> {
  const { data } = await http.put<AuthResponse>("/auth/me", {
    username: form.username,
    password: form.password || null,
    name: form.name,
    department: form.department || null,
    team: form.team || null,
    position: form.position || null
  });
  return data.user;
}

export async function fetchMe(): Promise<AuthUser | null> {
  bootLog("fetchMe.start");
  try {
    const { data } = await http.get<AuthResponse>("/auth/me");
    bootLog("fetchMe.ok", { userId: data.user?.userId ?? null });
    return data.user;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      bootLog("fetchMe.unauthorized");
      return null;
    }
    bootError("fetchMe.error", error, { status: axios.isAxiosError(error) ? error.response?.status : null });
    throw error;
  }
}

export async function fetchUsernameOk(name: string): Promise<boolean> {
  const { data } = await http.get<{ ok: boolean }>("/auth/check", {
    params: { name }
  });
  return data.ok;
}
