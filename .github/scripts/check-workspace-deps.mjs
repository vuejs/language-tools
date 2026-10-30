// Fails unless every workspace package that a released package depends on, but
// that release.yml does not publish itself (such as a package of a git
// submodule), is on npm at its exact workspace version and was released from the
// commit checked out here. pnpm rewrites `workspace:*` to that version on
// publish, so a version that is on npm with other code, like an unbumped
// submodule version, would make the released packages install code they were
// neither built nor tested with.
//
// A commit counts as released when it is the `gitHead` npm recorded for the
// version, or the commit of the `v<version>` tag on the remote of its repository.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const run = (cmd, args, options) =>
	execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
const root = run('git', ['rev-parse', '--show-toplevel']);
const registry = run('npm', ['config', 'get', 'registry']).replace(/\/?$/, '/');
// the packages of lerna.json, which release.yml versions and publishes
const released = dir => /^(packages|extensions)\//.test(relative(root, dir));

const workspace = new Map();
for (const { path: dir } of JSON.parse(run('pnpm', ['ls', '-r', '--depth', '-1', '--json']))) {
	const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
	if (manifest.name) {
		workspace.set(manifest.name, { dir, manifest });
	}
}

const errors = [];
const external = new Map();
for (const { dir, manifest } of workspace.values()) {
	if (!released(dir) || manifest.private) {
		continue;
	}
	for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
		for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
			const target = workspace.get(name);
			if (!target || (released(target.dir) && !target.manifest.private)) {
				continue;
			}
			const { version } = target.manifest;
			if (spec !== 'workspace:*' && spec !== `workspace:${version}` && spec !== version) {
				errors.push(`${manifest.name} ${field} ${name}@${spec} does not pin the workspace version ${version}`);
				continue;
			}
			if (!external.has(name)) {
				external.set(name, { ...target, users: [] });
			}
			external.get(name).users.push(manifest.name);
		}
	}
}

for (const [name, { dir, manifest, users }] of external) {
	const { version } = manifest;
	const id = `${name}@${version}`;
	const usedBy = `used by ${[...new Set(users)].join(', ')}`;
	if (manifest.private) {
		errors.push(`${id} is private, ${usedBy}`);
		continue;
	}
	const head = run('git', ['rev-parse', 'HEAD'], { cwd: dir });
	if (run('git', ['rev-parse', '--show-toplevel'], { cwd: dir }) === root) {
		errors.push(`${id} is in this repository but release.yml does not publish it, ${usedBy}`);
		continue;
	}
	const response = await fetch(new URL(`${name.replace('/', '%2f')}/${version}`, registry), { cache: 'no-store' });
	if (response.status !== 404 && !response.ok) {
		throw new Error(`${id}: the registry answered ${response.status}`);
	}
	const published = response.ok ? await response.json() : undefined;
	if (published?.version !== version) {
		errors.push(`${id} is not on npm; release it from ${relative(root, dir)} first, ${usedBy}`);
		continue;
	}
	if (published.gitHead === head) {
		console.log(`${id}: on npm, gitHead ${head}`);
		continue;
	}
	const refs = run('git', ['ls-remote', 'origin', `refs/tags/v${version}`, `refs/tags/v${version}^{}`], { cwd: dir })
		.split('\n')
		.filter(Boolean)
		.map(line => line.split('\t'));
	const tagged = (refs.find(([, ref]) => ref.endsWith('^{}')) ?? refs[0])?.[0];
	if (tagged === head) {
		console.log(`${id}: on npm, tag v${version} is ${head}`);
		continue;
	}
	errors.push(
		`${id} on npm was not released from ${relative(root, dir)} at ${head} (npm gitHead ${
			published.gitHead ?? 'none'
		}, tag v${version} ${
			tagged ?? 'missing'
		}); release that commit with a new version and update the submodule, ${usedBy}`,
	);
}

if (errors.length) {
	for (const error of errors) {
		console.log(`::error::${error}`);
	}
	process.exit(1);
}
console.log(`${external.size} workspace dependencies outside this release checked`);
