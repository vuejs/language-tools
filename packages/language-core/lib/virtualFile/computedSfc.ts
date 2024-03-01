import type * as CompilerDOM from '@vue/compiler-dom';
import type { SFCBlock, SFCParseResult } from '@vue/compiler-sfc';
import { computed, computedArray, pauseTracking, resetTracking } from 'computeds';
import type * as ts from 'typescript';
import type { Sfc, SfcBlock, VueLanguagePlugin } from '../types';
import { parseCssClassNames } from '../utils/parseCssClassNames';
import { parseCssVars } from '../utils/parseCssVars';

export function computedSfc(
	ts: typeof import('typescript'),
	plugins: ReturnType<VueLanguagePlugin>[],
	fileName: string,
	snapshot: () => ts.IScriptSnapshot,
	parsed: () => SFCParseResult | undefined
): Sfc {

	const untrackedSnapshot = () => {
		pauseTracking();
		const res = snapshot();
		resetTracking();
		return res;
	};
	const template = computedNullableSfcBlock(
		'template',
		'html',
		computed(() => parsed()?.descriptor.template ?? undefined),
		(_block, base): NonNullable<Sfc['template']> => {
			const compiledAst = computedTemplateAst(base);
			return mergeObject(base, {
				get ast() { return compiledAst()?.ast; },
				get errors() { return compiledAst()?.errors; },
				get warnings() { return compiledAst()?.warnings; },
			});
		},
	);
	const script = computedNullableSfcBlock(
		'script',
		'js',
		computed(() => parsed()?.descriptor.script ?? undefined),
		(block, base): NonNullable<Sfc['script']> => {
			const src = computed(() => block().src);
			const srcOffset = computed(() => {
				const _src = src();
				return _src ? untrackedSnapshot().getText(0, base.startTagEnd).lastIndexOf(_src) - base.startTagEnd : -1;
			});
			const ast = computed(() => ts.createSourceFile(fileName + '.' + base.lang, base.content, 99 satisfies ts.ScriptTarget.Latest));
			return mergeObject(base, {
				get src() { return src(); },
				get srcOffset() { return srcOffset(); },
				get ast() { return ast(); },
			});
		},
	);
	const scriptSetup = computedNullableSfcBlock(
		'scriptSetup',
		'js',
		computed(() => parsed()?.descriptor.scriptSetup ?? undefined),
		(block, base): NonNullable<Sfc['scriptSetup']> => {
			const generic = computed(() => {
				const _block = block();
				return typeof _block.attrs.generic === 'string' ? _block.attrs.generic : undefined;
			});
			const genericOffset = computed(() => {
				const _generic = generic();
				return _generic !== undefined ? untrackedSnapshot().getText(0, base.startTagEnd).lastIndexOf(_generic) - base.startTagEnd : -1;
			});
			const ast = computed(() => ts.createSourceFile(fileName + '.' + base.lang, base.content, 99 satisfies ts.ScriptTarget.Latest));
			return mergeObject(base, {
				get generic() { return generic(); },
				get genericOffset() { return genericOffset(); },
				get ast() { return ast(); },
			});
		},
	);
	const styles = computedArray(
		computed(() => parsed()?.descriptor.styles ?? []),
		(block, i) => {
			const base = computedSfcBlock('style_' + i, 'css', block);
			const module = computed(() => typeof block().module === 'string' ? block().module as string : block().module ? '$style' : undefined);
			const scoped = computed(() => !!block().scoped);
			const cssVars = computed(() => [...parseCssVars(base.content)]);
			const classNames = computed(() => [...parseCssClassNames(base.content)]);
			return computed<Sfc['styles'][number]>(() => mergeObject(base, {
				get module() { return module(); },
				get scoped() { return scoped(); },
				get cssVars() { return cssVars(); },
				get classNames() { return classNames(); },
			}));
		}
	);
	const customBlocks = computedArray(
		computed(() => parsed()?.descriptor.customBlocks ?? []),
		(block, i) => {
			const base = computedSfcBlock('customBlock_' + i, 'txt', block);
			const type = computed(() => block().type);
			return computed<Sfc['customBlocks'][number]>(() => mergeObject(base, {
				get type() { return type(); },
			}));
		}
	);

	return {
		get template() { return template(); },
		get script() { return script(); },
		get scriptSetup() { return scriptSetup(); },
		get styles() { return styles; },
		get customBlocks() { return customBlocks; },
		get templateAst() { return template()?.ast; },
		get scriptAst() { return script()?.ast; },
		get scriptSetupAst() { return scriptSetup()?.ast; },
	};

	function computedTemplateAst(base: SfcBlock) {

		let cache: {
			template: string,
			snapshot: ts.IScriptSnapshot,
			result: CompilerDOM.CodegenResult,
			plugin: ReturnType<VueLanguagePlugin>,
		} | undefined;

		return computed(() => {

			if (cache?.template === base.content) {
				return {
					errors: [],
					warnings: [],
					ast: cache?.result.ast,
				};
			}

			// incremental update
			if (cache?.plugin.updateSFCTemplate) {

				const change = untrackedSnapshot().getChangeRange(cache.snapshot);
				if (change) {

					pauseTracking();
					const templateOffset = base.startTagEnd;
					resetTracking();

					const newText = untrackedSnapshot().getText(change.span.start, change.span.start + change.newLength);
					const newResult = cache.plugin.updateSFCTemplate(cache.result, {
						start: change.span.start - templateOffset,
						end: change.span.start + change.span.length - templateOffset,
						newText,
					});
					if (newResult) {
						cache.template = base.content;
						cache.snapshot = untrackedSnapshot();
						cache.result = newResult;
						return {
							errors: [],
							warnings: [],
							ast: newResult.ast,
						};
					}
				}
			}

			const errors: CompilerDOM.CompilerError[] = [];
			const warnings: CompilerDOM.CompilerError[] = [];
			let options: CompilerDOM.CompilerOptions = {
				onError: (err: CompilerDOM.CompilerError) => errors.push(err),
				onWarn: (err: CompilerDOM.CompilerError) => warnings.push(err),
				expressionPlugins: ['typescript'],
			};

			for (const plugin of plugins) {
				if (plugin.resolveTemplateCompilerOptions) {
					options = plugin.resolveTemplateCompilerOptions(options);
				}
			}

			for (const plugin of plugins) {

				let result: CompilerDOM.CodegenResult | undefined;

				try {
					result = plugin.compileSFCTemplate?.(base.lang, base.content, options);
				}
				catch (e) {
					const err = e as CompilerDOM.CompilerError;
					errors.push(err);
				}

				if (result || errors.length) {

					if (result && !errors.length && !warnings.length) {
						cache = {
							template: base.content,
							snapshot: untrackedSnapshot(),
							result: result,
							plugin,
						};
					}
					else {
						cache = undefined;
					}

					return {
						errors,
						warnings,
						ast: result?.ast,
					};
				}
			}

			return {
				errors,
				warnings,
				ast: undefined,
			};
		});
	}

	function computedNullableSfcBlock<T extends SFCBlock, K extends SfcBlock>(
		name: string,
		defaultLang: string,
		block: () => T | undefined,
		resolve: (block: () => T, base: SfcBlock) => K,
	) {
		const hasBlock = computed(() => !!block());
		return computed<K | undefined>(() => {
			if (!hasBlock()) {
				return;
			}
			const _block = computed(() => block()!);
			return resolve(_block, computedSfcBlock(name, defaultLang, _block));
		});
	}

	function computedSfcBlock<T extends SFCBlock>(
		name: string,
		defaultLang: string,
		block: () => T,
	) {
		const lang = computed(() => block().lang ?? defaultLang);
		const attrs = computed(() => block().attrs); // TODO: computed it
		const content = computed(() => block().content);
		const startTagEnd = computed(() => block().loc.start.offset);
		const endTagStart = computed(() => block().loc.end.offset);
		const start = computed(() => untrackedSnapshot().getText(0, startTagEnd()).lastIndexOf('<' + block().type));
		const end = computed(() => endTagStart() + untrackedSnapshot().getText(endTagStart(), untrackedSnapshot().getLength()).indexOf('>') + 1);
		return {
			name,
			get lang() { return lang(); },
			get attrs() { return attrs(); },
			get content() { return content(); },
			get startTagEnd() { return startTagEnd(); },
			get endTagStart() { return endTagStart(); },
			get start() { return start(); },
			get end() { return end(); },
		};
	}
}

function mergeObject<T, K>(a: T, b: K): T & K {
	return Object.defineProperties(a, Object.getOwnPropertyDescriptors(b)) as T & K;
}
