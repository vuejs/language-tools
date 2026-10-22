import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { getExtensionFormats, resolveContentMappers } from '../lib/contentMappers';

describe('contentMappers', () => {
	let tmpDir = '';

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	function writeConfigs(configs: Record<string, object>) {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-content-mappers-'));
		for (const [name, config] of Object.entries(configs)) {
			fs.writeFileSync(path.join(tmpDir, name), JSON.stringify(config));
		}
	}

	function mapper(extension: string, format?: string) {
		return { package: '@vue/content-mapper', extensions: [extension], options: format ? { format } : undefined };
	}

	function extensionFormats(name: string) {
		return getExtensionFormats(ts, ts.sys, path.join(tmpDir, name).replace(/\\/g, '/'));
	}

	it('lets a later extends entry win over an earlier one and its bases', () => {
		writeConfigs({
			'tsconfig.json': { extends: ['./a.json', './c.json'] },
			'a.json': { extends: './b.json', contentMappers: [mapper('.a')] },
			'b.json': { contentMappers: [mapper('.b')] },
			'c.json': { contentMappers: [mapper('.c', 'vitepress')] },
		});
		expect(extensionFormats('tsconfig.json')).toEqual({ '.c': 'vitepress' });
	});

	it('lets a config own contentMappers win over its base', () => {
		writeConfigs({
			'tsconfig.json': { extends: './a.json' },
			'a.json': { extends: './b.json', contentMappers: [mapper('.a', 'petite-vue')] },
			'b.json': { contentMappers: [mapper('.b')] },
		});
		expect(extensionFormats('tsconfig.json')).toEqual({ '.a': 'petite-vue' });
	});

	it('lets an own empty array win over the inherited contentMappers', () => {
		writeConfigs({
			'tsconfig.json': { extends: './base.json', contentMappers: [] },
			'base.json': { contentMappers: [mapper('.vue')] },
		});
		expect(extensionFormats('tsconfig.json')).toEqual({});
	});

	it('resolves a base shared by several extends entries for each of them', () => {
		writeConfigs({
			'tsconfig.json': { extends: ['./a.json', './c.json'] },
			'a.json': { extends: './b.json' },
			'b.json': { contentMappers: [mapper('.b')] },
			'c.json': { extends: ['./d.json', './b.json'] },
			'd.json': { contentMappers: [mapper('.d')] },
		});
		expect(extensionFormats('tsconfig.json')).toEqual({ '.b': 'sfc' });
	});

	it('maps .vue as an SFC without contentMappers', () => {
		writeConfigs({ 'tsconfig.json': {} });
		expect(extensionFormats('tsconfig.json')).toEqual({ '.vue': 'sfc' });
		expect(getExtensionFormats(ts, ts.sys, undefined)).toEqual({ '.vue': 'sfc' });
	});

	it('stops at cyclic extends', () => {
		writeConfigs({
			'a.json': { extends: './b.json' },
			'b.json': { extends: './a.json', contentMappers: [mapper('.b')] },
		});
		expect(resolveContentMappers(ts, ts.sys, path.join(tmpDir, 'a.json').replace(/\\/g, '/'))).toEqual([
			mapper('.b'),
		]);
	});
});
