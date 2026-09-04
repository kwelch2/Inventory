import type { User } from 'firebase/auth';

export const ADMIN_EMAIL_DOMAIN = 'gemfireems.org';

export const isAuthorizedAdmin = (user: User | null): boolean =>
  Boolean(user?.email?.toLowerCase().endsWith(`@${ADMIN_EMAIL_DOMAIN}`));
