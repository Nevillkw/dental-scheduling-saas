/**
 * Server-side Broadcast via the Realtime REST API.
 * No websocket is opened inside a serverless function — we send a single POST.
 * The channel is PUBLIC, the payload carries no PII (only start_time).
 */

export type BroadcastEvent = "taken" | "freed";

export function channelName(tenantId: string, doctorId: string): string {
  return `clinic:${tenantId}:doctor:${doctorId}`;
}

export async function broadcastSlot(params: {
  tenantId: string;
  doctorId: string;
  startTime: string; // ISO UTC
  event: BroadcastEvent;
}): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // service-role or anon — a public broadcast accepts either
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: channelName(params.tenantId, params.doctorId),
            event: params.event,
            payload: { start_time: params.startTime },
          },
        ],
      }),
    });
  } catch {
    // Broadcast is best-effort UX. A failure must not break the booking.
  }
}
