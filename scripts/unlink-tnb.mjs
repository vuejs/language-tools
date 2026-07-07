#!/usr/bin/env node
/**
 * Restore stock typescript from pnpm lockfile (undo link:tnb).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const volarRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const r = spawnSync('pnpm', ['install'], { cwd: volarRoot, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('unlink:tnb restored stock typescript from lockfile');
