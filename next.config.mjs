/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // CSV lead imports send the file text to a server action (2 MB file limit + JSON overhead).
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  // Route names from the brief (§10) that map onto pages already built under other paths.
  async redirects() {
    const alias = (source, destination) => ({ source, destination, permanent: false });
    return [
      alias('/vision', '/about#vision'),
      alias('/courses', '/programs'),
      alias('/courses/:slug', '/programs/:slug'),
      alias('/bsat', '/scholarship'),
      alias('/dashboard', '/crm'),
      alias('/dashboard/management', '/crm/dashboard'),
      alias('/dashboard/crm', '/crm/leads'),
      alias('/dashboard/crm/:id', '/crm/leads/:id'),
      alias('/dashboard/followups', '/crm'),
      alias('/dashboard/visits', '/crm/visits'),
      alias('/dashboard/verification', '/crm/verification'),
      alias('/dashboard/students', '/crm/students'),
      alias('/dashboard/attendance', '/crm/academics'),
      alias('/dashboard/exams', '/crm/academics'),
      alias('/dashboard/fees', '/crm/accounts'),
      alias('/dashboard/notices', '/crm/notices'),
      alias('/dashboard/hostel', '/crm/hostel'),
      alias('/dashboard/transport', '/crm/transport'),
      alias('/dashboard/users', '/crm/staff'),
      alias('/dashboard/ai-assistant', '/crm/college-assistant'),
      alias('/student', '/app'),
      alias('/parent', '/app'),
    ];
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
