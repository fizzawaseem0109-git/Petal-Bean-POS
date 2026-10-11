// Cross-platform first-time setup: installs both apps and creates server/.env if it's missing.
import { execSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
run('npm --prefix server install');
run('npm --prefix client install');
if (!existsSync('server/.env')) {
  copyFileSync('server/.env.example', 'server/.env');
  console.log('\n✔ Created server/.env (edit it to change the MongoDB address, PIN, shop name, etc.)');
}
console.log('\nSetup done. Make sure MongoDB is running, then:  npm run dev');
