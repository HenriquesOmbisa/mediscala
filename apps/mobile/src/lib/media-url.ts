export const API_ORIGIN =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, "") ??
  "http://localhost:3001";

/** Absolute URL for `/uploads/...` paths served by the API. */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const base = API_ORIGIN.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
