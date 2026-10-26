import * as CompilerDOM from '@vue/compiler-dom';
import type { TemplateBlockScope, TemplateExpression, TemplateScope, VueSource } from '@vue/language-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts5 from 'typescript-5';
import { expect, test } from 'vitest';
import { resolveMapperOptions } from '../lib/mapper/mapperOptions';
import { createSource, generateFromSource, repositoryRoot } from './utils';

const workspace = path.join(repositoryRoot, 'test-workspace');

interface MapperEntry {
	package: string;
	extensions?: string[];
	options?: Record<string, unknown>;
}

function readContentMappers(configFile: string): MapperEntry[] | undefined {
	const { config } = ts5.readConfigFile(configFile, ts5.sys.readFile);
	if (config?.contentMappers) {
		return config.contentMappers;
	}
	if (typeof config?.extends === 'string') {
		return readContentMappers(path.resolve(path.dirname(configFile), config.extends));
	}
}

/** The nearest tsconfig with a `@vue/content-mapper` entry for the file, as the TypeScript 7.1 project would pick. */
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

/** The generated code of `root`, and the entries of its template scope that the code generation read. */
function generateWithReads(root: VueSource) {
	const templateScope = root.analysis.getTemplateScope();
	const reads = new Set<TemplateExpression | TemplateBlockScope>();
	const track = <K, V extends TemplateExpression | TemplateBlockScope>(map: ReadonlyMap<K, V>) => {
		const get = map.get.bind(map);
		Object.defineProperty(map, 'get', {
			value: (key: K) => {
				const value = get(key);
				if (value) {
					reads.add(value);
				}
				return value;
			},
		});
	};
	templateScope.expressions.forEach(track);
	track(templateScope.blockScopes);
	const text = getText(root);
	return { templateScope, reads, text };
}

function getText(root: VueSource) {
	return generateFromSource(root).text;
}

function getEntries(templateScope: TemplateScope) {
	return [
		...[...templateScope.expressions].flatMap(([block, expressions]) =>
			[...expressions].map(([offset, expression]) =>
				[`${block.name}@${offset} ${expression.code}`, expression] as const
			)
		),
		...[...templateScope.blockScopes].map(([owner, scope]) =>
			[`block scope at ${'loc' in owner ? owner.loc.start.offset : 0}`, scope] as const
		),
	];
}

test('the code generation reads the scope of every expression and block scope that the template scope walks', () => {
	const files = findVueFiles(workspace);
	const unread: string[] = [];
	let expressions = 0;

	for (const fileName of files) {
		const [configFile, entry] = findMapperEntry(fileName);
		const { vueOptions } = resolveMapperOptions(ts5.sys.readFile, configFile, entry?.options);
		const content = fs.readFileSync(fileName, 'utf8');
		const { templateScope, reads } = generateWithReads(createSource(fileName, content, vueOptions));
		for (const [name, value] of getEntries(templateScope)) {
			expressions++;
			if (!reads.has(value)) {
				unread.push(`${path.relative(workspace, fileName)}: ${name}`);
			}
		}
	}

	expect(files.length).toBeGreaterThan(400);
	expect(expressions).toBeGreaterThan(1500);
	expect(unread).toEqual([]);
});

const source = `
<script setup lang="ts">
const list = [1];
let value = 1;
</script>

<template>
	<div v-for="item in list" @click="list; item">{{value + item}}</div>
</template>
`;

/** A root with its own IR, which the tests may change: the IR of a file is shared by the roots of its content. */
function createSourceRoot(name: string) {
	return createSource(
		`/${name}.vue`,
		`${source}<!-- ${name} -->\n`,
		resolveMapperOptions(ts5.sys.readFile, undefined, undefined).vueOptions,
	);
}

test('the code generation fails for an expression that the template scope does not walk', () => {
	const root = createSourceRoot('missing');
	const start = source.indexOf('value + item') - root.ir.template!.startTagEnd;
	const expressions = root.analysis.getTemplateScope().expressions.get(root.ir.template!) as Map<
		number,
		TemplateExpression
	>;
	expect(expressions.delete(start)).toBe(true);

	expect(() => getText(root)).toThrow(
		`The template scope has no expression \`value + item\` at offset ${start} of template.`,
	);
});

test('the code generation reads the locals and the members of a template expression from the template scope', () => {
	const original = getText(createSourceRoot('references'));
	expect(original).toContain(`__VLS_unwrap(value, {} as import('vue').Ref<unknown>) + item`);

	const root = createSourceRoot('changedReferences');
	const start = source.indexOf('value + item') - root.ir.template!.startTagEnd;
	const { references } = root.analysis.getTemplateScope().expressions.get(root.ir.template!)!.get(start)!;
	const [value, item] = references;
	expect([value!.name, value!.local, item!.name, item!.local]).toEqual(['value', false, 'item', true]);
	value!.local = true;
	item!.member = false;

	const text = getText(root);
	expect(text).toContain(`(value + item);`);
	expect(text.split('__VLS_scope.constructor').length).toBe(original.split('__VLS_scope.constructor').length - 1);
});

test('the code generation reads the block scopes of the template from the template scope', () => {
	const original = getText(createSourceRoot('blockScopes'));
	expect(original).toContain(`__VLS_Scope & { item: typeof item }`);

	const root = createSourceRoot('changedBlockScopes');
	const [, forNode] = [...root.analysis.getTemplateScope().blockScopes].find(([owner]) =>
		'type' in owner && owner.type === CompilerDOM.NodeTypes.FOR
	)!;
	forNode.locals.push('extra');

	expect(getText(root)).toContain(`__VLS_Scope & { item: typeof item; extra: typeof extra }`);
});
