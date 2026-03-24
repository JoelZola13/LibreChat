export function getBackendBaseUrl(): string {
  const envUrl = process.env.STREETBOT_BACKEND_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }
  return "http://localhost:8000";
}

