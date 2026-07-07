#!/usr/bin/env node
/**
 * Symlink node_modules/typescript to a local typescript-native-bridge checkout.
 *
 * Usage:
 *   pnpm run link:tnb
 *   TNB_ROOT=/path/to/typescript-native-bridge pnpm run link:tnb
 */
import { accessSync, constants, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const volarRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolveTnbRoot() {
	if (process.env.TNB_ROOT) {
		return path.resolve(process.env.TNB_ROOT);
	}
	const candidates = [
		path.resolve(volarRoot, '../typescript-native-bridge'),
		path.resolve(volarRoot, '../../GitHub/typescript-native-bridge'),
		path.resolve(volarRoot, '../../typescript-native-bridge'),
	];
	for (const candidate of candidates) {
		try {
			accessSync(path.join(candidate, 'lib/typescript.js'), constants.R_OK);
			return candidate;
		} catch {
			// try next layout
		}
	}
	throw new Error(
		'typescript-native-bridge not found. Set TNB_ROOT or clone next to volar (../typescript-native-bridge).',
	);
}

function findTypescriptPnpmSlot() {
	const pnpmDir = path.join(volarRoot, 'node_modules/.pnpm');
	let entries;
	try {
		entries = readdirSync(pnpmDir);
	} catch {
		throw new Error('node_modules missing — run pnpm install first');
	}
	const folder = entries.find(name => /^typescript@/.test(name));
	if (!folder) {
		throw new Error('pnpm typescript package not found — run pnpm install first');
	}
	return {
		slot: path.join(pnpmDir, folder, 'node_modules/typescript'),
		pnpmFolder: folder,
	};
}

function main() {
	const tnb = resolveTnbRoot();
	const { slot: tsSlot, pnpmFolder } = findTypescriptPnpmSlot();
	const tsTop = path.join(volarRoot, 'node_modules/typescript');
	const version = JSON.parse(readFileSync(path.join(tnb, 'package.json'), 'utf8')).version;

	rmSync(tsSlot, { recursive: true, force: true });
	symlinkSync(tnb, tsSlot);
	rmSync(tsTop, { recursive: true, force: true });
	symlinkSync(`.pnpm/${pnpmFolder}/node_modules/typescript`, tsTop);

	const resolved = spawnSync(process.execPath, ['-e', "console.log(require.resolve('typescript/package.json'))"], {
		cwd: volarRoot,
		encoding: 'utf8',
	});
	const resolvedPath = resolved.stdout.trim();
	if (!resolvedPath.includes('typescript-native-bridge')) {
		throw new Error(`link verification failed: ${resolvedPath || resolved.stderr}`);
	}

	console.log(`link:tnb ${tsSlot} -> ${tnb}`);
	console.log(`typescript@${version} (TNB)`);
	console.log(`verify: ${path.join(tnb, 'lib/tsserver.js')}`);
	console.log('Run with: GODEBUG=asyncpreemptoff=1 pnpm exec vitest run');
}

main();
