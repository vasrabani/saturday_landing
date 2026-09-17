// Build the visual reference images from the design reference commit.
//
//   npm run baseline            screenshots of the commit in tools/visual-baseline-ref
//   npm run baseline -- <ref>   screenshots of any other commit
//
// The reference commit is checked out into a throwaway git worktree and
// served on its own port, and Playwright writes its screenshots to
// tests/visual/__baseline__/ (git-ignored). `npm run test:visual` then
// compares the working tree against them. Screenshots are never
// committed: fonts render slightly differently per OS, so each machine
// and CI run builds its own reference from the same commit.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKTREE = join(ROOT, '.baseline');
const SNAPSHOT_DIR = join(ROOT, 'tests', 'visual', '__baseline__');
const BASELINE_PORT = '4174';

const ref = process.argv[2] ?? readFileSync(join(ROOT, 'tools', 'visual-baseline-ref'), 'utf8').trim();
const git = (...args) => execFileSync('git', args, { cwd: ROOT, stdio: 'inherit' });

console.log(`Building visual reference images from ${ref}`);
spawnSync('git', ['worktree', 'remove', '--force', WORKTREE], { cwd: ROOT, stdio: 'ignore' });
rmSync(WORKTREE, { recursive: true, force: true });
rmSync(SNAPSHOT_DIR, { recursive: true, force: true });
git('worktree', 'add', '--detach', WORKTREE, ref);

try {
  const run = spawnSync(
    'npx',
    ['playwright', 'test', '--project=visual-*', '--update-snapshots=all', '--reporter=dot'],
    { cwd: ROOT, stdio: 'inherit', shell: true, env: { ...process.env, SITE_ROOT: WORKTREE, PORT: BASELINE_PORT } },
  );
  process.exitCode = run.status ?? 1;
} finally {
  git('worktree', 'remove', '--force', WORKTREE);
}
