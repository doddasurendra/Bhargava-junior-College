import { maskPhone } from '../phone';
import { can } from './permissions';
import type { Staff } from './types';

/** §9A.1 field masking: roles without `phone.view` see "******7575"; they call through click-to-call. */
export const phoneFor = (user: Pick<Staff, 'roles'> & { perms?: readonly string[] }, phone: string | null | undefined): string => {
  if (!phone) return '';
  return can(user, 'phone.view') ? phone : maskPhone(phone);
};

export const seesPhones = (user: Pick<Staff, 'roles'> & { perms?: readonly string[] }) => can(user, 'phone.view');
