import { readFileIfExists } from '@vue/language-core/lib/options/readFileIfExists';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { API } from 'typescript/sync' with { 'resolution-mode': 'import' };
import { afterAll, expect, test } from 'vitest';
import { resolveMapperOptions } from '../lib/mapper/mapperOptions';
import { SpanMapKind } from '../lib/protocol';
import { toSpanMappings } from '../lib/result/spanMappings';
import { createSource, generateFromSource, repositoryRoot } from './utils';

const workspace = path.join(repositoryRoot, 'test-workspace');
const { API: TypeScriptAPI }: { API: typeof API } = require('typescript/sync');
const api = new TypeScriptAPI();
afterAll(() => api.close());

interface MapperEntry {
	package: string;
	extensions?: string[];
	options?: Record<string, unknown>;
}

function readContentMappers(configFile: string): MapperEntry[] | undefined {
	const config = api.readConfigFile(configFile).config as
		| { contentMappers?: MapperEntry[]; extends?: unknown }
		| undefined;
	if (config?.contentMappers) {
		return config.contentMappers;
	}
	if (typeof config?.extends === 'string') {
		return readContentMappers(path.resolve(path.dirname(configFile), config.extends));
	}
}

function findMapperEntry(fileName: string): [configFile: string | undefined, entry: MapperEntry | undefined] {
	for (let dir = path.dirname(fileName); dir.startsWith(workspace); dir = path.dirname(dir)) {
		const configFile = path.join(dir, 'tsconfig.json');
		if (fs.existsSync(configFile)) {
			const entry = readContentMappers(configFile)
				?.filter(entry => entry.package === '@vue/content-mapper')
				.find(entry => entry.extensions?.some(extension => fileName.endsWith(extension)));
			if (entry) {
				return [configFile, entry];
			}
		}
	}
	return [undefined, undefined];
}

function findVueFiles(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			return entry.name === 'node_modules' ? [] : findVueFiles(fullPath);
		}
		return entry.name.endsWith('.vue') ? [fullPath] : [];
	}).sort();
}

// Snapshots only show that the mappings did not change; these checks show that they are right.
test('every mapping of the workspace maps its chars to the right source chars', () => {
	const files = findVueFiles(workspace);
	const wrong: string[] = [];
	let checked = 0;

	for (const fileName of files) {
		const [configFile, entry] = findMapperEntry(fileName);
		const { vueOptions } = resolveMapperOptions(readFileIfExists, configFile, entry?.options);
		const content = fs.readFileSync(fileName, 'utf8');
		const { text, mappings: segments } = generateFromSource(createSource(fileName, content, vueOptions));
		const report = (problem: string) => wrong.push(`${path.relative(workspace, fileName)}: ${problem}`);
		const mappings = toSpanMappings(segments, text, content);
		const seen = new Set<string>();
		let previousStart = 0;
		let coveredEnd = 0;
		for (const mapping of mappings) {
			const [virtualStart, virtualLength, originalStart, originalLength, kind] = mapping;
			const key = mapping.join();
			checked++;
			if (seen.has(key)) {
				report(`duplicate mapping ${key}`);
			}
			seen.add(key);
			if (virtualStart < previousStart) {
				report(`mapping ${key} is out of order`);
			}
			previousStart = virtualStart;
			if (
				virtualStart < 0 || virtualStart + virtualLength > text.length
				|| originalStart < 0 || originalStart + originalLength > content.length
			) {
				report(`mapping ${key} is out of bounds`);
			}
			if (virtualLength) {
				if (virtualStart < coveredEnd) {
					report(`mapping ${key} overlaps a previous one`);
				}
				coveredEnd = Math.max(coveredEnd, virtualStart + virtualLength);
			}
			if (
				kind === SpanMapKind.Verbatim
				&& (virtualLength !== originalLength
					|| text.slice(virtualStart, virtualStart + virtualLength)
						!== content.slice(originalStart, originalStart + originalLength))
			) {
				report(`verbatim mapping ${key} does not copy its source`);
			}
		}
	}

	expect(files.length).toBeGreaterThan(400);
	expect(checked).toBeGreaterThan(10000);
	expect(wrong).toEqual([]);
});
