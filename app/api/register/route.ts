import { adminAuth } from '@/lib/firebase-admin';
import { db, handle, HttpError, readBody, verifyUid } from '@/lib/server';
import type { AppUser, Role } from '@/lib/domain';

// Public self-registration. Admin accounts can never be created here.
const ALLOWED: Role[] = ['traveller', 'airline', 'agency'];

export const POST = handle(async (req) => {
  const uid = await verifyUid(req);
  const { role, name, orgName } = await readBody<{ role: Role; name: string; orgName?: string }>(req);
  if (!ALLOWED.includes(role)) throw new HttpError(400, 'Invalid account type');
  if (!name?.trim()) throw new HttpError(400, 'Name is required');
  if (role !== 'traveller' && !orgName?.trim()) throw new HttpError(400, 'Organisation name is required');

  const ref = db.doc(`users/${uid}`);
  if ((await ref.get()).exists) throw new HttpError(409, 'Account already registered');
  const user: AppUser = {
    uid,
    email: (await adminAuth.getUser(uid)).email ?? '',
    name: name.trim(),
    ...(role !== 'traveller' && { orgName: orgName!.trim() }),
    role,
    // Business accounts register free but need admin approval.
    status: role === 'traveller' ? 'approved' : 'pending',
    createdAt: Date.now(),
  };
  await ref.create(user);
  return { user };
});
