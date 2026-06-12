import axios from "axios";
import http from "./http";
import type { AuthUser, LoginForm, ProfileForm, SignupForm } from "../types/auth";

interface AuthResponse {
  user: AuthUser;
}

export async function signup(form: SignupForm): Promise<AuthUser> {
  const { data } = await http.post<AuthResponse>("/auth/signup", {
    username: form.username,
    password: form.password,
    userName: form.userName,
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
  await http.post("/auth/logout");
}

export async function updateUser(form: ProfileForm): Promise<AuthUser> {
  const { data } = await http.put<AuthResponse>("/auth/me", {
    username: form.username,
    password: form.password || null,
    userName: form.userName,
    department: form.department || null,
    team: form.team || null,
    position: form.position || null
  });
  return data.user;
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const { data } = await http.get<AuthResponse>("/auth/me");
    return data.user;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function fetchUsernameOk(name: string): Promise<boolean> {
  const { data } = await http.get<{ ok: boolean }>("/auth/check", {
    params: { name }
  });
  return data.ok;
}
