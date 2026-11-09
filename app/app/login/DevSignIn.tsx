import { devAppSignIn } from './devActions';

/** Demo families from `npm run seed:demo`. Shown only in local development. */
const DEMO = [
  { label: 'Rahul', note: 'student · JEE-A', phone: '+919000000101' },
  { label: 'K. Srinivas', note: 'parent · 2 children', phone: '+919000000001' },
  { label: 'K. Lakshmi', note: 'parent', phone: '+919000000011' },
  { label: 'Ananya', note: 'student · NEET', phone: '+919000000102' },
  { label: 'Sneha Reddy', note: 'applicant', phone: '+919000000201' },
  { label: 'Another student', note: 'student', phone: '+919000003002' },
  { label: 'Another parent', note: 'parent', phone: '+919000002002' },
];

export function DevSignIn() {
  return (
    <div className="card mt-6 border-dashed p-5">
      <p className="text-sm font-semibold text-heading">Local development: sign in as</p>
      <p className="mt-1 text-xs text-muted">Sample data — run <code>npm run seed:demo</code> first. Not available on the live site.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {DEMO.map((d) => (
          <form key={d.phone} action={devAppSignIn}>
            <input type="hidden" name="phone" value={d.phone} />
            <button className="btn-outline w-full py-2 text-left text-sm">
              <span className="block font-medium">{d.label}</span>
              <span className="block text-xs text-muted">{d.note}</span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
