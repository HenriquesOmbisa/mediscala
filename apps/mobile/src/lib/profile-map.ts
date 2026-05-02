import type { AuthResponse } from "@mediscala/shared";

export type MeRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  specialty: string | null;
  department_id: string | null;
  avatar_url: string | null;
  contract_hours_week: number;
  active: boolean;
  created_at: string;
  department_name?: string | null;
};

export function meRowToAuthUser(
  row: MeRow,
  tenantSlug: string,
): AuthResponse["user"] {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as AuthResponse["user"]["role"],
    specialty: row.specialty,
    tenantSlug,
    avatarUrl: row.avatar_url ?? undefined,
    departmentId: row.department_id ?? undefined,
  };
}
