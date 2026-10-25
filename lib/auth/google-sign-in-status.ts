/**
 * Whether the gateway offers Google sign-in to the App right now: the operator switch
 * `google_sign_in.app` in Backstage config AND the gateway's Google configuration.
 *
 * Plain `fetch`, not the http-client: the endpoint is public and is read before there is a session.
 * Any failure (network, 404 from a gateway that predates the endpoint, an odd body) reads as `false`,
 * so the button stays hidden instead of leading to an error.
 * @param backendUrl - Gateway base URL from the runtime config
 * @returns true only when the gateway answers `{ enabled: true }`
 */
export async function fetchGoogleSignInEnabled(
  backendUrl: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${backendUrl.replace(/\/+$/, "")}/api/auth/google/status?app=app`,
    );
    if (!res.ok) return false;
    const body = (await res.json()) as { enabled?: unknown } | null;
    return body?.enabled === true;
  } catch {
    return false;
  }
}
