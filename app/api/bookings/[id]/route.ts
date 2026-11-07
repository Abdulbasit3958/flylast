import type { Booking } from '@/lib/domain';
import { db, handle, HttpError, requireUser } from '@/lib/server';

// One booking (for the e-ticket page). Visible to whoever booked it, the airline flying it, and admins.
export const GET = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req, ['traveller', 'agency', 'airline', 'admin']);
  const b = (await db.doc(`bookings/${(await params).id}`).get()).data() as Booking | undefined;
  const allowed = b && (user.role === 'admin' || b.userId === user.uid || (user.role === 'airline' && b.airlineId === user.uid));
  if (!allowed) throw new HttpError(404, 'E-ticket not found');
  return { booking: b };
});
