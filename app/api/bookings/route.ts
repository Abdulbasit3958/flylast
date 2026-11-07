import type { Booking } from '@/lib/domain';
import { db, handle, requireUser, rows } from '@/lib/server';

// Each role sees only its own slice: travellers/agencies their bookings, airlines their passenger manifest, admin everything.
export const GET = handle(async (req) => {
  const user = await requireUser(req, ['traveller', 'agency', 'airline', 'admin']);
  const col = db.collection('bookings');
  const q = user.role === 'admin' ? col : col.where(user.role === 'airline' ? 'airlineId' : 'userId', '==', user.uid);
  return { bookings: rows<Booking>(await q.get()).sort((a, b) => b.createdAt - a.createdAt) };
});
