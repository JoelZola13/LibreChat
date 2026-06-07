export const PUBLIC_PATHS_EXACT = [
  "/",
];

export const PUBLIC_PATH_PREFIXES = [
  "/learning",
  "/academy",
  "/agents",
  "/profiles",
  "/profile",
  "/creatives",
  "/groups",
  "/word-on-the-street",
  "/forum",
  "/gallery",
  "/messages",
  "/jobs",
  "/news",
  "/directory",
  "/notifications",
  "/onboarding",
  "/login",
  "/register",
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
