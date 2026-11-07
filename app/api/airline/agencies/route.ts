import type { AppUser } from '@/lib/domain';
import { db, handle, HttpError, readBody, requireUser, rows } from '@/lib/server';

type Auth = { airlineId: string; agencyId: string; active: boolean };

export const GET = handle(async (req) => {
  const user = await requireUser(req, ['airline']);
  const [agencies, auths] = await Promise.all([
    db.collection('users').where('role', '==', 'agency').get(),
    db.collection('agency_authorizations').where('airlineId', '==', user.uid).get(),
  ]);
  const active = new Set(rows<Auth>(auths).filter((a) => a.active).map((a) => a.agencyId));
  return {
    agencies: rows<AppUser>(agencies)
      .filter((a) => a.status === 'approved')
      .map((a) => ({ uid: a.uid, orgName: a.orgName, email: a.email, authorized: active.has(a.uid) })),
  };
});

// Grant or revoke an agency's right to distribute this airline's offers.
export const POST = handle(async (req) => {
  const user = await requireUser(req, ['airline']);
  const { agencyId, active } = await readBody<{ agencyId: string; active: boolean }>(req);
  const agency = (await db.doc(`users/${agencyId}`).get()).data() as AppUser | undefined;
  if (agency?.role !== 'agency' || agency.status !== 'approved') throw new HttpError(400, 'Unknown agency');
  await db.doc(`agency_authorizations/${user.uid}_${agencyId}`).set({ airlineId: user.uid, agencyId, active: !!active } satisfies Auth);
  return { ok: true };
});
