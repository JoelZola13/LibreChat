export const PUBLIC_PATHS_EXACT = [
  "/",
];

export const PUBLIC_PATH_PREFIXES = [
  "/learning",
  "/academy",
  "/onboarding",
  "/login",
  "/signup",
  "/auth",
  "/api",
  "/_next",
  "/favicon",
  "/public",
  "/callback",
];

export function isPublicPath(pathname?: string | null): boolean {
  if (!pathname) return false;
  if (PUBLIC_PATHS_EXACT.includes(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((path) => pathname.startsWith(path));
}
