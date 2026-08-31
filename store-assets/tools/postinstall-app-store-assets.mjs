import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isIosRelease = process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_WORKFLOW === 'iOS Release';
if (!isIosRelease) {
  console.log('App Store screenshot upload skipped outside the iOS Release workflow.');
  process.exit(0);
}

let commitMessage = '';
try {
  commitMessage = execFileSync('git', ['log', '-1', '--pretty=%B'], { encoding: 'utf8' });
} catch {
  console.log('App Store screenshot upload skipped because the release commit could not be identified.');
  process.exit(0);
}

if (!commitMessage.includes('[app-store-assets]')) {
  console.log('App Store screenshot upload skipped; this release commit has no asset upload marker.');
  process.exit(0);
}

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const uploader = path.join(toolsDir, 'upload-app-store-screenshots.mjs');
const result = spawnSync(process.execPath, [uploader, '--commit'], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
