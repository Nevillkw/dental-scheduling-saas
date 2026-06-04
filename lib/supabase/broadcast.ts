/**
 * Server-side Broadcast przez REST API Realtime.
 * Nie otwieramy websocketu w funkcji serverless — wysylamy pojedynczy POST.
 * Kanal jest PUBLICZNY, payload bez PII (tylko start_time).
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
  // service-role lub anon — broadcast publiczny akceptuje oba
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
    // Broadcast to best-effort UX. Porazka nie moze wywrocic bookingu.
  }
}
