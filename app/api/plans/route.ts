import { getPlans, handle } from '@/lib/server';

export const GET = handle(async () => ({ plans: (await getPlans()).filter((p) => p.isActive) }));
