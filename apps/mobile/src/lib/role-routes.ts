import type { UserRole } from "@mediscala/shared";

export type AppHomeRoute =
  | "/(app)/collaborator/shifts"
  | "/(app)/manager/shifts"
  | "/(app)/hospital-admin/shifts"
  | "/(app)/shifts";

export type EditProfileRoute =
  | "/(app)/collaborator/edit-profile"
  | "/(app)/manager/edit-profile"
  | "/(app)/hospital-admin/edit-profile"
  | "/(app)/edit-profile";

export function getInitialAppRouteByRole(
  role?: UserRole | null,
): AppHomeRoute {
  if (role === "COLLABORATOR") {
    return "/(app)/collaborator/shifts";
  }

  if (role === "MANAGER") {
    return "/(app)/manager/shifts";
  }

  if (role === "HOSPITAL_ADMIN") {
    return "/(app)/hospital-admin/shifts";
  }

  return "/(app)/shifts";
}

export function getEditProfileRouteByRole(
  role?: UserRole | null,
): EditProfileRoute {
  if (role === "COLLABORATOR") {
    return "/(app)/collaborator/edit-profile";
  }

  if (role === "MANAGER") {
    return "/(app)/manager/edit-profile";
  }

  if (role === "HOSPITAL_ADMIN") {
    return "/(app)/hospital-admin/edit-profile";
  }

  return "/(app)/edit-profile";
}
