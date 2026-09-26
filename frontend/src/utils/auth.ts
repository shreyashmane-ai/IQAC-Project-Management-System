/**
 * Auth context utilities and types
 */

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  role_display: string;
  phone?: string;
  department?: string;
  designation?: string;
  employee_id?: string;
  is_active: boolean;
  totp_enabled: boolean;
  last_login?: string;
  last_login_ip?: string;
  can_manage_programs: boolean;
  is_program_admin: boolean;
  is_system_admin: boolean;
  program_scopes?: Record<string, string>[];
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
}

export interface AuthState {
  user: AuthUser | null;
  tokens: TokenPair | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const AUTH_STORAGE_KEYS = {
  access: 'iqac_access',
  refresh: 'iqac_refresh',
  user: 'iqac_user',
} as const;

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
}

export function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function hasRole(user: AuthUser | null, ...roles: string[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

export function isSystemAdmin(user: AuthUser | null): boolean {
  return user?.is_system_admin === true;
}

export function isProgramAdmin(user: AuthUser | null): boolean {
  return user?.is_program_admin === true;
}

export function canManagePrograms(user: AuthUser | null): boolean {
  return user?.can_manage_programs === true;
}