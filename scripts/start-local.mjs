// Runs the production build against the local JSON store (.data/) for testing on a low-memory machine.
// Never used on Vercel (the app refuses the file store there). Build first: npm run build
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const next = require.resolve('next/dist/bin/next');
const child = spawn(process.execPath, [next, 'start', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, LOCAL_FILE_STORE: '1' } });
child.on('exit', (code) => process.exit(code ?? 0));
