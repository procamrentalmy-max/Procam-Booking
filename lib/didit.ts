import "server-only";

const DIDIT_API_BASE = "https://verification.didit.me";

function diditHeaders(): HeadersInit {
  return {
    "x-api-key": process.env.DIDIT_API_KEY!,
    "Content-Type": "application/json",
  };
}

/**
 * Starts a Didit KYC session (ID document + liveness + face match, per the
 * workflow configured in the Didit dashboard). The returned url is opened in
 * Didit's hosted modal client-side — nothing about our own booking wizard
 * state is affected, since the modal never navigates the browser away.
 */
export async function createDiditSession(vendorData: string): Promise<{ sessionId: string; url: string }> {
  const res = await fetch(`${DIDIT_API_BASE}/v3/session/`, {
    method: "POST",
    headers: diditHeaders(),
    body: JSON.stringify({
      workflow_id: process.env.DIDIT_WORKFLOW_ID,
      vendor_data: vendorData,
    }),
  });
  if (!res.ok) throw new Error(`Could not start identity verification (Didit ${res.status})`);
  const data = await res.json();
  return { sessionId: data.session_id as string, url: data.url as string };
}

/**
 * The modal's own onComplete callback reports a status too, but that's a
 * client-reported signal — this server-side call against Didit's own API is
 * the authoritative check before a booking is ever allowed to proceed.
 */
export async function getDiditSessionStatus(sessionId: string): Promise<string> {
  const res = await fetch(`${DIDIT_API_BASE}/v3/session/${sessionId}/decision/`, {
    headers: diditHeaders(),
  });
  if (!res.ok) throw new Error(`Could not check verification status (Didit ${res.status})`);
  const data = await res.json();
  return data.status as string;
}
