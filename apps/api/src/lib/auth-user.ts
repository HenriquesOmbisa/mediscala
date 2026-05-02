import type { UserRole } from "@mediscala/shared";

export function serializeAuthUser(
  row: {
    id: string;
    name: string;
    email: string;
    role: string;
    specialty: string | null;
    avatar_url?: string | null;
    department_id?: string | null;
  },
  tenantSlug: string,
) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    specialty: row.specialty ?? null,
    tenantSlug,
    avatarUrl: row.avatar_url ?? null,
    departmentId: row.department_id ?? null,
  };
}
