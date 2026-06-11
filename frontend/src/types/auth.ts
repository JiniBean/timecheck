export interface AuthUser {
  userId: number;
  username: string;
  userName: string;
  department: string | null;
  team: string | null;
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
}

export interface ProfileForm {
  username: string;
  password: string;
  userName: string;
  department: string;
  team: string;
}
