import * as CompilerDOM from '@vue/compiler-dom';
import type { SFCBlock, SFCParseResult } from '@vue/compiler-sfc';
import { computed, setActiveSub } from 'alien-signals';
import type * as ts from 'typescript';
import type { Sfc, SfcBlock, SfcBlockAttr, VueLanguagePluginReturn } from '../types';
import { computedArray, reactiveArray } from '../utils/signals';
import { normalizeTemplateAST } from './normalize';

export function useIR(
	ts: typeof import('typescript'),
	plugins: VueLanguagePluginReturn[],
	fileName: string,
	getSnapshot: () => ts.IScriptSnapshot,
	getParseSfcResult: () => SFCParseResult | undefined,
): Sfc {
	const getUntrackedSnapshot = () => {
		const pausedSub = setActiveSub(undefined);
		const res = getSnapshot();
		setActiveSub(pausedSub);
		return res;
	};
	const getContent = computed(() => {
		return getSnapshot().getText(0, getSnapshot().getLength());
	});
	const getComments = computedArray(() => {
		return getParseSfcResult()?.descriptor.comments ?? [];
	});
	const getTemplate = useNullableSfcBlock(
		'template',
		'html',
		computed(() => getParseSfcResult()?.descriptor.template ?? undefined),
		(_block, base): NonNullable<Sfc['template']> => {
			const getParseTemplateResult = useParseTemplateResult(base);
			return mergeObject(base, {
				get ast() {
					return getParseTemplateResult().result?.ast;
				},
				get errors() {
					return getParseTemplateResult().errors;
				},
				get warnings() {
					return getParseTemplateResult().warnings;
				},
			});
		},
	);
	const getScript = useNullableSfcBlock(
		'script',
		'js',
		computed(() => getParseSfcResult()?.descriptor.script ?? undefined),
		(block, base): NonNullable<Sfc['script']> => {
			const getSrc = useAttrValue('__src', base, block);
			const getAst = computed(() => {
				for (const plugin of plugins) {
					const ast = plugin.compileSFCScript?.(base.lang, base.content);
					if (ast) {
						return ast;
					}
				}
				return ts.createSourceFile(fileName + '.' + base.lang, '', 99 satisfies ts.ScriptTarget.Latest);
			});
			return mergeObject(base, {
				get src() {
					return getSrc();
				},
				get ast() {
					return getAst();
				},
			});
		},
	);
	const getOriginalScriptSetup = useNullableSfcBlock(
		'scriptSetup',
		'js',
		computed(() => getParseSfcResult()?.descriptor.scriptSetup ?? undefined),
		(block, base): NonNullable<Sfc['scriptSetup']> => {
			const getGeneric = useAttrValue('__generic', base, block);
			const getAst = computed(() => {
				for (const plugin of plugins) {
					const ast = plugin.compileSFCScript?.(base.lang, base.content);
					if (ast) {
						return ast;
					}
				}
				return ts.createSourceFile(fileName + '.' + base.lang, '', 99 satisfies ts.ScriptTarget.Latest);
			});
			return mergeObject(base, {
				get generic() {
					return getGeneric();
				},
				get ast() {
					return getAst();
				},
			});
		},
	);
	const hasScript = computed(() => !!getParseSfcResult()?.descriptor.script);
	const hasScriptSetup = computed(() => !!getParseSfcResult()?.descriptor.scriptSetup);
	const getScriptSetup = computed(() => {
		if (!hasScript() && !hasScriptSetup()) {
			// #region monkey fix: https://github.com/vuejs/language-tools/pull/2113
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
		return getOriginalScriptSetup();
	});
	const styles = reactiveArray(
		() => getParseSfcResult()?.descriptor.styles ?? [],
		(getBlock, i) => {
			const base = useSfcBlock('style_' + i, 'css', getBlock);
			const getSrc = useAttrValue('__src', base, getBlock);
			const getModule = useAttrValue('__module', base, getBlock);
			const getScoped = computed(() => !!getBlock().scoped);
			const getIr = computed(() => {
				for (const plugin of plugins) {
					const ast = plugin.compileSFCStyle?.(base.lang, base.content);
					if (ast) {
						return ast;
					}
				}
			});
			const getImports = computedArray(
				() => getIr()?.imports ?? [],
				(oldItem, newItem) => oldItem.text === newItem.text && oldItem.offset === newItem.offset,
			);
			const getBindings = computedArray(
				() => getIr()?.bindings ?? [],
				(oldItem, newItem) => oldItem.text === newItem.text && oldItem.offset === newItem.offset,
			);
			const getClassNames = computedArray(
				() => getIr()?.classNames ?? [],
				(oldItem, newItem) => oldItem.text === newItem.text && oldItem.offset === newItem.offset,
			);
			return () =>
				mergeObject(base, {
					get src() {
						return getSrc();
					},
					get module() {
						return getModule();
					},
					get scoped() {
						return getScoped();
					},
					get imports() {
						return getImports();
					},
					get bindings() {
						return getBindings();
					},
					get classNames() {
						return getClassNames();
					},
				}) satisfies Sfc['styles'][number];
		},
	);
	const customBlocks = reactiveArray(
		() => getParseSfcResult()?.descriptor.customBlocks ?? [],
		(getBlock, i) => {
			const base = useSfcBlock('custom_block_' + i, 'txt', getBlock);
			const getType = computed(() => getBlock().type);
			return () =>
				mergeObject(base, {
					get type() {
						return getType();
					},
				}) satisfies Sfc['customBlocks'][number];
		},
	);

	return {
		get content() {
			return getContent();
		},
		get comments() {
			return getComments();
		},
		get template() {
			return getTemplate();
		},
		get script() {
			return getScript();
		},
		get scriptSetup() {
			return getScriptSetup();
		},
		get styles() {
			return styles;
		},
		get customBlocks() {
			return customBlocks;
		},
	};

	function useParseTemplateResult(base: SfcBlock) {
		return computed<{
			snapshot: ts.IScriptSnapshot;
			template: string;
			errors: CompilerDOM.CompilerError[];
			warnings: CompilerDOM.CompilerError[];
			result?: CompilerDOM.CodegenResult;
			plugin?: VueLanguagePluginReturn;
		}>(lastResult => {
			if (lastResult?.template === base.content) {
				return lastResult;
			}

			// incremental update
			if (
				lastResult?.result && lastResult.plugin?.updateSFCTemplate
				&& !lastResult.errors.length
				&& !lastResult.warnings.length
			) {
				const change = getUntrackedSnapshot().getChangeRange(lastResult.snapshot);
				if (change) {
					const pausedSub = setActiveSub(undefined);
					const templateOffset = base.startTagEnd;
					setActiveSub(pausedSub);

					const newText = getUntrackedSnapshot().getText(change.span.start, change.span.start + change.newLength);
					const newResult = lastResult.plugin.updateSFCTemplate(lastResult.result, {
						start: change.span.start - templateOffset,
						end: change.span.start - templateOffset + change.span.length,
						newText,
					});
					if (newResult) {
						return {
							snapshot: getUntrackedSnapshot(),
							template: base.content,
							result: newResult,
							plugin: lastResult.plugin,
							errors: [],
							warnings: [],
						};
					}
				}
			}

			const errors: CompilerDOM.CompilerError[] = [];
			const warnings: CompilerDOM.CompilerError[] = [];
			const [nodeTransforms, directiveTransforms] = CompilerDOM.getBaseTransformPreset();

			let options: CompilerDOM.CompilerOptions = {
				onError: err => errors.push(err),
				onWarn: err => warnings.push(err),
				expressionPlugins: ['typescript'],
				nodeTransforms,
				directiveTransforms,
			};

			for (const plugin of plugins) {
				if (plugin.resolveTemplateCompilerOptions) {
					options = plugin.resolveTemplateCompilerOptions(options);
				}
			}

			for (const plugin of plugins) {
				try {
					const result = plugin.compileSFCTemplate?.(base.lang, base.content, options);
					if (result) {
						normalizeTemplateAST(result.ast);
						return {
							snapshot: getUntrackedSnapshot(),
							template: base.content,
							result,
							plugin,
							errors,
							warnings,
						};
					}
				}
				catch (e) {
					return {
						snapshot: getUntrackedSnapshot(),
						template: base.content,
						plugin,
						errors: [e as CompilerDOM.CompilerError],
						warnings,
					};
				}
			}

			return {
				snapshot: getUntrackedSnapshot(),
				template: base.content,
				errors,
				warnings,
			};
		});
	}

	function useNullableSfcBlock<T extends SFCBlock, K extends SfcBlock>(
		name: string,
		defaultLang: string,
		getBlock: () => T | undefined,
		resolve: (block: () => T, base: SfcBlock) => K,
	) {
		const hasBlock = computed(() => !!getBlock());
		return computed<K | undefined>(() => {
			if (!hasBlock()) {
				return;
			}
			const _block = computed(() => getBlock()!);
			return resolve(_block, useSfcBlock(name, defaultLang, _block));
		});
	}

	function useSfcBlock(
		name: string,
		defaultLang: string,
		getBlock: () => SFCBlock,
	) {
		const getLang = computed(() => getBlock().lang ?? defaultLang);
		const getAttrs = computed(() => getBlock().attrs); // TODO: computed it
		const getContent = computed(() => getBlock().content);
		const getStartTagEnd = computed(() => getBlock().loc.start.offset);
		const getEndTagStart = computed(() => getBlock().loc.end.offset);
		const getStart = computed(() =>
			getUntrackedSnapshot().getText(0, getStartTagEnd()).lastIndexOf('<' + getBlock().type)
		);
		const getEnd = computed(() =>
			getEndTagStart()
			+ getUntrackedSnapshot().getText(getEndTagStart(), getUntrackedSnapshot().getLength()).indexOf('>') + 1
		);
		return {
			name,
			get lang() {
				return getLang();
			},
			get attrs() {
				return getAttrs();
			},
			get content() {
				return getContent();
			},
			get startTagEnd() {
				return getStartTagEnd();
			},
			get endTagStart() {
				return getEndTagStart();
			},
			get start() {
				return getStart();
			},
			get end() {
				return getEnd();
			},
		};
	}

	function useAttrValue<T extends SFCBlock>(
		key: keyof T & string,
		base: ReturnType<typeof useSfcBlock>,
		getBlock: () => T,
	) {
		return computed(() => {
			const val = getBlock()[key] as SfcBlockAttr | undefined;
			if (typeof val === 'object') {
				return {
					...val,
					offset: base.start + val.offset,
				};
			}
			return val;
		});
	}
}

function mergeObject<T, K>(a: T, b: K): T & K {
	return Object.defineProperties(a, Object.getOwnPropertyDescriptors(b)) as T & K;
}
