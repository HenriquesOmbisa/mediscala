/** Resolve API-served paths (e.g. `/uploads/...`) for same-origin dev (Vite proxy). */
export function publicAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}
