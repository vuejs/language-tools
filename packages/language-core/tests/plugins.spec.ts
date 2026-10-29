import { SpanMapKind, type SpanMapSegment } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import { describe, expect, it } from 'vitest';
import { createIRPipeline } from '../lib/ir/irPipeline';
import { getDefaultCompilerOptions } from '../lib/options/compilerOptions';
import type { SFCParseResult, VueCompilerOptions } from '../lib/types';
import { ts } from './typescript';

const legacyMessage =
	'VueLanguagePlugin functions are no longer supported; export `{ ir: … }` (see language-core README)';

function segment(virtualStart: number, length: number, originalStart: number): SpanMapSegment {
	return {
		virtualStart,
		virtualEnd: virtualStart + length,
		originalStart,
		originalEnd: originalStart + length,
		kind: SpanMapKind.Verbatim,
		features: 0,
	};
}

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

const toHTML = (tag: string) => ({ html: `<${tag}/>`, mappings: [] });
const firstTag = (result: ReturnType<ReturnType<typeof createIRPipeline>['compileTemplate']>) =>
	(result?.result.ast.children[0] as { tag?: string } | undefined)?.tag;

describe('createIRPipeline', () => {
	it.each([
		['a function', () => ({ version: 4 })],
		['an array of functions', [() => ({ version: 4 })]],
		['an object with a version', { version: 4, compileSFCTemplate: () => toHTML('legacy') }],
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
							pug: (source: string) => toHTML(source),
						},
					},
				},
			}),
		);
		expect(pipeline.errors).toEqual([]);
		expect(firstTag(pipeline.compileTemplate('pug', 'div', {}))).toBe('div');
	});

	it('gives the AST of the HTML of a template language the offsets of the template', () => {
		const html = '<div>x</div><i></i><p v-if></p>';
		const errors: [number, number][] = [];
		const ignored: (number | string)[] = [];
		const pipeline = createIRPipeline(
			ts,
			withPlugins({
				lang: {
					ir: {
						templateCompilers: {
							lang: () => ({
								html,
								mappings: [
									segment(0, 5, 0), // `<div>`
									segment(5, 1, 10), // `x`
									segment(19, 12, 30), // `<p v-if></p>`
								],
								ignoreError: (error: CompilerDOM.CompilerError) => {
									ignored.push(error.code);
									return false;
								},
							}),
						},
					},
				},
			}),
		);
		const ast = pipeline.compileTemplate('lang', '', {
			onError: error => errors.push([error.loc!.start.offset, error.loc!.end.offset]),
		})!.result.ast;
		const [div, i] = ast.children as [CompilerDOM.ElementNode, CompilerDOM.ElementNode];
		// an offset of several sources: the end of `<div>` and the start of `x`
		expect([div.children[0]!.loc.start.offset, div.children[0]!.loc.end.offset]).toEqual([10, 11]);
		// a location of which only the start has a source
		expect([div.loc.start.offset, div.loc.end.offset]).toEqual([-1, -1]);
		// a location of no source
		expect([i.loc.start.offset, i.loc.end.offset]).toEqual([-1, -1]);
		// an error at the offsets of the template
		expect(ignored).toEqual([CompilerDOM.ErrorCodes.X_V_IF_NO_EXPRESSION]);
		expect(errors).toEqual([[33, 37]]);
	});

	it('does not report an error that the template language ignores', () => {
		const errors: unknown[] = [];
		const pipeline = createIRPipeline(
			ts,
			withPlugins({
				lang: {
					ir: {
						templateCompilers: {
							lang: () => ({ html: '<p v-if></p>', mappings: [], ignoreError: () => true }),
						},
					},
				},
			}),
		);
		pipeline.compileTemplate('lang', '', { onError: error => errors.push(error) });
		expect(errors).toEqual([]);
	});

	it('rejects a template language or format that is built in', () => {
		const pipeline = createIRPipeline(
			ts,
			withPlugins({
				html: {
					ir: {
						templateCompilers: { html: () => toHTML('html') },
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
				first: { ir: { templateCompilers: { pug: () => toHTML('first') } } },
				second: { ir: { templateCompilers: { pug: () => toHTML('second') } } },
			}),
		);
		expect(pipeline.errors).toEqual([
			{ plugin: 'second', message: `The template compiler 'pug' is already provided by 'first'.` },
		]);
		expect(firstTag(pipeline.compileTemplate('pug', 'div', {}))).toBe('first');
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
