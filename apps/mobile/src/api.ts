import { Platform } from "react-native";

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_URL = (
  configuredApiUrl ||
  (__DEV__ ? (Platform.OS === "android" ? "http://10.0.2.2:8787" : "http://localhost:8787") : "")
).replace(/\/$/, "");

export const API_CONFIGURED = API_URL.length > 0;

export class MuseApi {
  constructor(readonly token: string) {}
  async request<T>(path: string, body?: unknown, method?: string): Promise<T> {
    if (!API_CONFIGURED) {
      throw new Error("Remote workspace is not configured in this build.");
    }
    const response = await fetch(`${API_URL}${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body === undefined || body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(
        typeof payload.error === "string" ? payload.error : `Request failed (${response.status})`,
      );
    return payload;
  }
  url(path: string) {
    return path.startsWith("http") ? path : `${API_URL}${path}`;
  }
}

export async function createSession(
  accessKey?: string,
): Promise<{ token: string; mode: "sample" | "live" }> {
  if (!API_CONFIGURED) {
    throw new Error(
      "Remote workspace is not configured for this phone build. Device AI remains available locally.",
    );
  }
  const response = await fetch(`${API_URL}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessKey }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not open your workspace.");
  return payload;
}
