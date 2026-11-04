import type { Role } from './types';

/**
 * §9A.4 "each role lands on its own home dashboard with its tasks for today". Admissions roles use the
 * CRM task list at /crm; everyone else has a portal home.
 */
const HOMES: Partial<Record<string, string>> = {
  management: '/crm/dashboard',
  principal: '/crm/academics/overview',
  academic_coordinator: '/crm/academics',
  faculty: '/crm/academics/my-classes',
  class_teacher: '/crm/mentor',
  hostel_warden: '/crm/hostel',
  transport_incharge: '/crm/transport',
  accounts: '/crm/accounts',
  admin_office: '/crm/students',
  admission_office: '/crm/verification',
  front_desk: '/crm/front-desk',
  data_executive: '/crm/cms',
};

export function homeFor(role: Role | undefined): string {
  return (role && HOMES[role]) || '/crm';
}
