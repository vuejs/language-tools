import type * as CompilerDOM from '@vue/compiler-dom';
import { computed, setActiveSub } from 'alien-signals';
import type * as ts from 'typescript';
import type {
	IR,
	IRBlock,
	IRCustomBlock,
	IRScript,
	IRScriptSetup,
	IRStyle,
	IRTemplate,
	VueLanguagePluginReturn,
} from '../types';
import { computedArray, reactiveArray } from '../utils/signals';
import type { RawIR, RawIRBlock } from './rawIr';

export function useIR(
	ts: typeof import('typescript'),
	plugins: VueLanguagePluginReturn[],
	fileName: string,
	getSnapshot: () => ts.IScriptSnapshot,
	getRawIr: () => RawIR | undefined,
): IR {
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
		return getRawIr()?.comments ?? [];
	});
	const getScript = useNullableRawIRBlock(
		'script',
		'js',
		() => getRawIr()?.scripts.find(s => !s.attrs.setup && !s.attrs.vapor),
		(block, base): IRScript => {
			const getSrc = useAttr('src', base, block);
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
	const getOriginalScriptSetup = useNullableRawIRBlock(
		'scriptSetup',
		'js',
		() => getRawIr()?.scripts.find(s => s.attrs.setup || s.attrs.vapor),
		(block, base): IRScriptSetup => {
			const getGeneric = useAttr('generic', base, block);
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
	const getScriptSetup = computed(() => {
		if (!getRawIr()?.scripts.length) {
			// #region monkey fix: https://github.com/vuejs/language-tools/pull/2113
			return <IRScriptSetup> {
				content: '',
				lang: 'ts',
				name: '',
				start: 0,
				end: 0,
				innerStart: 0,
				innerEnd: 0,
				attrs: {},
				ast: ts.createSourceFile('', '', 99 satisfies ts.ScriptTarget.Latest, false, ts.ScriptKind.TS),
			};
		}
		return getOriginalScriptSetup();
	});
	const templates = reactiveArray(
		() => getRawIr()?.templates ?? [],
		(getBlock, i) => {
			const base = useIRBlock(i ? 'template_' + i : 'template', 'html', getBlock);
			const getParseTemplateResult = useParseTemplateResult(base);
			return (): IRTemplate =>
				mergeObject(base, {
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
	const styles = reactiveArray(
		() => getRawIr()?.styles ?? [],
		(getBlock, i) => {
			const base = useIRBlock('style_' + i, 'css', getBlock);
			const getSrc = useAttr('src', base, getBlock);
			const getModule = useAttr('module', base, getBlock);
			const getScoped = computed(() => !!getBlock().attrs.scoped);
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
			return (): IRStyle =>
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
				});
		},
	);
	const customBlocks = reactiveArray(
		() => getRawIr()?.customBlocks ?? [],
		(getBlock, i) => {
			const base = useIRBlock('custom_block_' + i, 'txt', getBlock);
			const getType = computed(() => getBlock().name);
			return (): IRCustomBlock =>
				mergeObject(base, {
					get type() {
						return getType();
					},
				});
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
			return templates[0];
		},
		get script() {
			return getScript();
		},
		get scriptSetup() {
			return getScriptSetup();
		},
		get templates() {
			return templates;
		},
		get styles() {
			return styles;
		},
		get customBlocks() {
			return customBlocks;
		},
	};

	function useParseTemplateResult(base: IRBlock) {
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
					const templateOffset = base.innerStart;
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
			let options: CompilerDOM.CompilerOptions = {
				onError: err => errors.push(err),
				onWarn: err => warnings.push(err),
				expressionPlugins: ['typescript'],
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

	function useNullableRawIRBlock<T extends RawIRBlock, K extends IRBlock>(
		name: string,
		defaultLang: string,
		getBlock: () => T | undefined,
		resolve: (block: () => T, base: IRBlock) => K,
	) {
		const hasBlock = computed(() => !!getBlock());
		return computed<K | undefined>(() => {
			if (!hasBlock()) {
				return;
			}
			const _block = computed(() => getBlock()!);
			return resolve(_block, useIRBlock(name, defaultLang, _block));
		});
	}

	function useIRBlock(
		name: string,
		defaultLang: string,
		getBlock: () => RawIRBlock,
	) {
		const getLang = computed(() => getBlock().lang ?? defaultLang);
		const getAttrs = computed(() => getBlock().attrs); // TODO: computed it
		const getContent = computed(() => getBlock().content);
		const getInnerStart = computed(() => getBlock().innerStart);
		const getInnerEnd = computed(() => getBlock().innerEnd);
		const getStart = computed(() => getBlock().start);
		const getEnd = computed(() => getBlock().end);
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
			get innerStart() {
				return getInnerStart();
			},
			get innerEnd() {
				return getInnerEnd();
			},
			get start() {
				return getStart();
			},
			get end() {
				return getEnd();
			},
		};
	}

	function useAttr(
		key: string,
		base: ReturnType<typeof useIRBlock>,
		getBlock: () => RawIRBlock,
	) {
		return computed(() => {
			const val = getBlock().attrs[key];
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
