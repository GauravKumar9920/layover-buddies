import type { AdminRole } from '@/types/admin';

export function canAccessPath(role: AdminRole | undefined, path: string): boolean {
  if (!role) return false;
  if (role === 'owner') return true;
  if (path === '/overview' || path.startsWith('/platform/health') || path.startsWith('/platform/notifications') || path.startsWith('/platform/jobs')) return true;
  if (role === 'operations') return path.startsWith('/operations') || path.startsWith('/marketplace') || path.startsWith('/trust');
  if (role === 'finance') return path.startsWith('/money');
  if (role === 'growth') return path === '/growth' || path.startsWith('/content');
  return false;
}

export function canMutate(role: AdminRole | undefined, domain: 'operations' | 'safety' | 'finance' | 'growth' | 'team'): boolean {
  if (!role) return false;
  if (role === 'owner') return true;
  return (role === 'operations' && (domain === 'operations' || domain === 'safety'))
    || (role === 'finance' && domain === 'finance')
    || (role === 'growth' && domain === 'growth');
}
