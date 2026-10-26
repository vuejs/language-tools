import { describe, expect, it } from 'vitest';
import { createIRPipeline } from '../lib/ir/irPipeline';
import { getDefaultCompilerOptions } from '../lib/options/compilerOptions';
import type { SFCParseResult, VueCompilerOptions } from '../lib/types';
import { ts } from './typescript';

const legacyMessage =
	'VueLanguagePlugin functions are no longer supported; export `{ ir: … }` (see language-core README)';

function withPlugins(modules: Record<string, unknown>, options: Partial<VueCompilerOptions> = {}): VueCompilerOptions {
	return {
		...getDefaultCompilerOptions(),
		...options,
		plugins: Object.entries(modules).map(([name, module]) => ({
			name,
			file: `/project/node_modules/${name}/index.js`,
			config: {},
			module,
		})),
	};
}

const pugAst = (tag: string) => ({ ast: { tag }, code: '', preamble: '' }) as any;

describe('createIRPipeline', () => {
	it.each([
		['a function', () => ({ version: 4 })],
		['an array of functions', [() => ({ version: 4 })]],
		['an object with a version', { version: 4, compileSFCTemplate: () => pugAst('legacy') }],
	])('rejects a legacy export of %s', (_, module) => {
		const pipeline = createIRPipeline(ts, withPlugins({ legacy: module }));
		expect(pipeline.errors).toEqual([{ plugin: 'legacy', message: legacyMessage }]);
		expect(pipeline.compileTemplate('pug', 'div', {})).toBeUndefined();
	});

	it('compiles a template language with the template compiler of a plugin', () => {
		const pipeline = createIRPipeline(
			ts,
			withPlugins({
				pug: {
					ir: {
						templateCompilers: {
							pug: (source: string, _options: unknown, host: { compileTemplate: unknown }) =>
								typeof host.compileTemplate === 'function' ? pugAst(source) : undefined,
						},
					},
				},
			}),
		);
		expect(pipeline.errors).toEqual([]);
		expect(pipeline.compileTemplate('pug', 'div', {})?.result).toEqual(pugAst('div'));
	});

	it('rejects a template language or format that is built in', () => {
		const pipeline = createIRPipeline(
			ts,
			withPlugins({
				html: {
					ir: {
						templateCompilers: { html: () => pugAst('html') },
						formats: { sfc: { parse: () => undefined } },
					},
				},
			}),
		);
		expect(pipeline.errors).toEqual([
			{ plugin: 'html', message: `The format 'sfc' is built in and cannot be replaced.` },
			{ plugin: 'html', message: `The template compiler 'html' is built in and cannot be replaced.` },
		]);
		expect(pipeline.compileTemplate('html', '<div/>', {})?.result.ast?.children[0]).toMatchObject({ tag: 'div' });
		expect(pipeline.parse('/project/App.vue', '<template><div/></template>')?.result.descriptor.template)
			.toBeTruthy();
	});

	it('rejects a template language that an earlier plugin provides', () => {
		const pipeline = createIRPipeline(
			ts,
			withPlugins({
				first: { ir: { templateCompilers: { pug: () => pugAst('first') } } },
				second: { ir: { templateCompilers: { pug: () => pugAst('second') } } },
			}),
		);
		expect(pipeline.errors).toEqual([
			{ plugin: 'second', message: `The template compiler 'pug' is already provided by 'first'.` },
		]);
		expect(pipeline.compileTemplate('pug', 'div', {})?.result).toEqual(pugAst('first'));
	});

	it('parses with the format of a plugin that `format` selects', () => {
		const parsed = { descriptor: { filename: 'custom' }, errors: [] } as unknown as SFCParseResult;
		const custom = { ir: { formats: { custom: { parse: () => parsed } } } };

		const selected = createIRPipeline(ts, withPlugins({ custom }, { format: 'custom' }));
		expect(selected.errors).toEqual([]);
		expect(selected.parse('/project/App.vue', '')?.result).toBe(parsed);

		const notSelected = createIRPipeline(ts, withPlugins({ custom }));
		expect(notSelected.parse('/project/App.vue', '')?.result).not.toBe(parsed);
	});

	it('falls back to the SFC format for a format that nothing provides', () => {
		const pipeline = createIRPipeline(ts, withPlugins({}, { format: 'custom' }));
		expect(pipeline.errors).toEqual([
			{ message: `No format 'custom' is built in or provided by a plugin; 'sfc' is used instead.` },
		]);
		expect(pipeline.parse('/project/App.vue', '<template><div/></template>')?.result.descriptor.template)
			.toBeTruthy();
	});

	it('applies the template compiler options of the plugins in order', () => {
		const order: string[] = [];
		const resolve = (name: string) => (options: object) => {
			order.push(name);
			return options;
		};
		const pipeline = createIRPipeline(
			ts,
			withPlugins({
				a: { ir: { resolveTemplateCompilerOptions: resolve('a') } },
				b: { ir: () => ({ resolveTemplateCompilerOptions: resolve('b') }) },
			}),
		);
		pipeline.compileTemplate('html', '<div/>', {});
		expect(order).toEqual(['a', 'b']);
	});
});
