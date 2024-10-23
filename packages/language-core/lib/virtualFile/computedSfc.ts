import type * as CompilerDOM from '@vue/compiler-dom';
import type { SFCBlock, SFCParseResult } from '@vue/compiler-sfc';
import { computed, ISignal, Signal, System, Unstable } from 'alien-signals';
import type * as ts from 'typescript';
import type { Sfc, SfcBlock, SFCStyleOverride, VueLanguagePluginReturn } from '../types';
import { parseCssClassNames } from '../utils/parseCssClassNames';
import { parseCssVars } from '../utils/parseCssVars';

export function computedSfc(
	ts: typeof import('typescript'),
	plugins: VueLanguagePluginReturn[],
	fileName: string,
	snapshot: Signal<ts.IScriptSnapshot>,
	parsed: ISignal<SFCParseResult | undefined>
): Sfc {

	const untrackedSnapshot = () => {
		const prevTrackId = System.activeTrackId = 0;
		System.activeTrackId = 0;
		const res = snapshot.get();
		System.activeTrackId = prevTrackId;
		return res;
	};
	const content = computed(() => {
		return snapshot.get().getText(0, snapshot.get().getLength());
	});
	const template = computedNullableSfcBlock(
		'template',
		'html',
		computed(() => parsed.get()?.descriptor.template ?? undefined),
		(_block, base): NonNullable<Sfc['template']> => {
			const compiledAst = computedTemplateAst(base);
			return mergeObject(base, {
				get ast() { return compiledAst.get()?.ast; },
				get errors() { return compiledAst.get()?.errors; },
				get warnings() { return compiledAst.get()?.warnings; },
			});
		}
	);
	const script = computedNullableSfcBlock(
		'script',
		'js',
		computed(() => parsed.get()?.descriptor.script ?? undefined),
		(block, base): NonNullable<Sfc['script']> => {
			const src = computed(() => block.get().src);
			const srcOffset = computed(() => {
				const _src = src.get();
				return _src ? untrackedSnapshot().getText(0, base.startTagEnd).lastIndexOf(_src) - base.startTagEnd : -1;
			});
			const ast = computed(() => {
				for (const plugin of plugins) {
					const ast = plugin.compileSFCScript?.(base.lang, base.content);
					if (ast) {
						return ast;
					}
				}
				return ts.createSourceFile(fileName + '.' + base.lang, '', 99 satisfies ts.ScriptTarget.Latest);
			});
			return mergeObject(base, {
				get src() { return src.get(); },
				get srcOffset() { return srcOffset.get(); },
				get ast() { return ast.get(); },
			});
		}
	);
	const scriptSetupOriginal = computedNullableSfcBlock(
		'scriptSetup',
		'js',
		computed(() => parsed.get()?.descriptor.scriptSetup ?? undefined),
		(block, base): NonNullable<Sfc['scriptSetup']> => {
			const generic = computed(() => {
				const _block = block.get();
				return typeof _block.attrs.generic === 'string' ? _block.attrs.generic : undefined;
			});
			const genericOffset = computed(() => {
				const _generic = generic.get();
				return _generic !== undefined ? untrackedSnapshot().getText(0, base.startTagEnd).lastIndexOf(_generic) - base.startTagEnd : -1;
			});
			const ast = computed(() => {
				for (const plugin of plugins) {
					const ast = plugin.compileSFCScript?.(base.lang, base.content);
					if (ast) {
						return ast;
					}
				}
				return ts.createSourceFile(fileName + '.' + base.lang, '', 99 satisfies ts.ScriptTarget.Latest);
			});
			return mergeObject(base, {
				get generic() { return generic.get(); },
				get genericOffset() { return genericOffset.get(); },
				get ast() { return ast.get(); },
			});
		}
	);
	const hasScript = computed(() => !!parsed.get()?.descriptor.script);
	const hasScriptSetup = computed(() => !!parsed.get()?.descriptor.scriptSetup);
	const scriptSetup = computed(() => {
		if (!hasScript.get() && !hasScriptSetup.get()) {
			//#region monkey fix: https://github.com/vuejs/language-tools/pull/2113
			return {
				content: '',
				lang: 'ts',
				name: '',
				start: 0,
				end: 0,
				startTagEnd: 0,
				endTagStart: 0,
				generic: undefined,
				genericOffset: 0,
				attrs: {},
				ast: ts.createSourceFile('', '', 99 satisfies ts.ScriptTarget.Latest, false, ts.ScriptKind.TS),
			};
		}
		return scriptSetupOriginal.get();
	});
	const styles = Unstable.computedArray(
		computed(() => parsed.get()?.descriptor.styles ?? []),
		(block, i) => {
			const base = computedSfcBlock('style_' + i, 'css', block);
			const module = computed(() => {
				const _module = block.get().module as SFCStyleOverride['module'];
				return _module ? {
					name: _module.name,
					offset: _module.offset ? base.start + _module.offset : undefined
				} : undefined;
			});
			const scoped = computed(() => !!block.get().scoped);
			const cssVars = computed(() => [...parseCssVars(base.content)]);
			const classNames = computed(() => [...parseCssClassNames(base.content)]);
			return () => mergeObject(base, {
				get module() { return module.get(); },
				get scoped() { return scoped.get(); },
				get cssVars() { return cssVars.get(); },
				get classNames() { return classNames.get(); },
			}) satisfies Sfc['styles'][number];
		}
	);
	const customBlocks = Unstable.computedArray(
		computed(() => parsed.get()?.descriptor.customBlocks ?? []),
		(block, i) => {
			const base = computedSfcBlock('custom_block_' + i, 'txt', block);
			const type = computed(() => block.get().type);
			return () => mergeObject(base, {
				get type() { return type.get(); },
			}) satisfies Sfc['customBlocks'][number];
		}
	);

	return {
		get content() { return content.get(); },
		get template() { return template.get(); },
		get script() { return script.get(); },
		get scriptSetup() { return scriptSetup.get(); },
		get styles() { return styles; },
		get customBlocks() { return customBlocks; },
	};

	function computedTemplateAst(base: SfcBlock) {

		let cache: {
			template: string,
			snapshot: ts.IScriptSnapshot,
			result: CompilerDOM.CodegenResult,
			plugin: VueLanguagePluginReturn,
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

					const prevTrackId = System.activeTrackId;
					System.activeTrackId = 0;
					const templateOffset = base.startTagEnd;
					System.activeTrackId = prevTrackId;

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
		block: ISignal<T | undefined>,
		resolve: (block: ISignal<T>, base: SfcBlock) => K
	) {
		const hasBlock = computed(() => !!block.get());
		return computed<K | undefined>(() => {
			if (!hasBlock.get()) {
				return;
			}
			const _block = computed(() => block.get()!);
			return resolve(_block, computedSfcBlock(name, defaultLang, _block));
		});
	}

	function computedSfcBlock<T extends SFCBlock>(
		name: string,
		defaultLang: string,
		block: ISignal<T>
	) {
		const lang = computed(() => block.get().lang ?? defaultLang);
		const attrs = computed(() => block.get().attrs); // TODO: computed it
		const content = computed(() => block.get().content);
		const startTagEnd = computed(() => block.get().loc.start.offset);
		const endTagStart = computed(() => block.get().loc.end.offset);
		const start = computed(() => untrackedSnapshot().getText(0, startTagEnd.get()).lastIndexOf('<' + block.get().type));
		const end = computed(() => endTagStart.get() + untrackedSnapshot().getText(endTagStart.get(), untrackedSnapshot().getLength()).indexOf('>') + 1);
		return {
			name,
			get lang() { return lang.get(); },
			get attrs() { return attrs.get(); },
			get content() { return content.get(); },
			get startTagEnd() { return startTagEnd.get(); },
			get endTagStart() { return endTagStart.get(); },
			get start() { return start.get(); },
			get end() { return end.get(); },
		};
	}
}

function mergeObject<T, K>(a: T, b: K): T & K {
	return Object.defineProperties(a, Object.getOwnPropertyDescriptors(b)) as T & K;
}
