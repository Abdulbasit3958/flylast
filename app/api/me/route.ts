import { db, getTravellerAccess, handle, verifyUid } from '@/lib/server';
import type { AppUser } from '@/lib/domain';

export const GET = handle(async (req) => {
  const uid = await verifyUid(req);
  const user = ((await db.doc(`users/${uid}`).get()).data() as AppUser | undefined) ?? null;
  if (user?.role !== 'traveller') return { user };
  return { user, ...(await getTravellerAccess(uid)) };
});
