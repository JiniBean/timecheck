export type UserRole = "USER" | "ADMIN";

export interface AuthUser {
  userId: number;
  username: string;
  userName: string;
  department: string | null;
  team: string | null;
  position: string | null;
  role: UserRole;
}

export interface LoginForm {
  username: string;
  password: string;
}

export interface SignupForm {
  username: string;
  password: string;
  userName: string;
  department: string;
  team: string;
  position: string;
}

export interface ProfileForm {
  username: string;
  password: string;
  userName: string;
  department: string;
  team: string;
  position: string;
}
