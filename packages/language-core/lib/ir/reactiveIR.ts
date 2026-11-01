import type { IScriptSnapshot } from '@volar/language-core';
import type * as CompilerDOM from '@vue/compiler-dom';
import { computed, setActiveSub } from 'alien-signals';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type {
	IR,
	IRBlock,
	IRCustomBlock,
	IRPipeline,
	IRScript,
	IRScriptSetup,
	IRStyle,
	IRTemplate,
	TemplateCompiler,
	TemplateCompileResult,
	TypeScript,
	VueFormatBlock,
	VueFormatResult,
} from '../types';
import { computedArray, reactiveArray } from './signals';

export function useIR(
	ts: TypeScript,
	pipeline: IRPipeline,
	fileName: string,
	getSnapshot: () => IScriptSnapshot,
	getFormatResult: () => VueFormatResult | undefined,
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
		return getFormatResult()?.comments ?? [];
	});
	const getErrors = computedArray(() => {
		return getFormatResult()?.errors ?? [];
	});
	const getVapor = computed(() => !!getFormatResult()?.vapor);
	const getTemplate = useNullableBlock(
		'template',
		computed(() => getFormatResult()?.template),
		(_block, base): IRTemplate => {
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
	const getScript = useNullableBlock(
		'script',
		computed(() => getFormatResult()?.script),
		(block, base): IRScript => {
			const getSrc = computed(() => block().src);
			const getAst = computed(() =>
				pipeline.compileScript(base.lang, base.content)
					?? ts.createSourceFile(fileName + '.' + base.lang, '', 99 satisfies ts.ScriptTarget.Latest)
			);
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
	const getOriginalScriptSetup = useNullableBlock(
		'scriptSetup',
		computed(() => getFormatResult()?.scriptSetup),
		(block, base): IRScriptSetup => {
			const getGeneric = computed(() => block().generic);
			const getAst = computed(() =>
				pipeline.compileScript(base.lang, base.content)
					?? ts.createSourceFile(fileName + '.' + base.lang, '', 99 satisfies ts.ScriptTarget.Latest)
			);
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
	const hasScript = computed(() => !!getFormatResult()?.script);
	const hasScriptSetup = computed(() => !!getFormatResult()?.scriptSetup);
	const getScriptSetup = computed(() => {
		if (!hasScript() && !hasScriptSetup()) {
			// #region monkey fix: https://github.com/vuejs/language-tools/pull/2113
			return {
				content: '',
				lang: 'ts',
				name: '',
				offset: 0,
				element: undefined,
				generic: undefined,
				genericOffset: 0,
				ast: ts.createSourceFile('/dummy.ts', '', 99 satisfies ts.ScriptTarget.Latest, false, ts.ScriptKind.TS),
			};
		}
		return getOriginalScriptSetup();
	});
	const styles = reactiveArray(
		() => getFormatResult()?.styles ?? [],
		(getBlock, i) => {
			const base = useBlock('style_' + i, getBlock);
			const getSrc = computed(() => getBlock().src);
			const getModule = computed(() => getBlock().module);
			const getScoped = computed(() => !!getBlock().scoped);
			const getIr = computed(() => pipeline.compileStyle(base.lang, base.content));
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
		() => getFormatResult()?.customBlocks ?? [],
		(getBlock, i) => {
			const base = useBlock('custom_block_' + i, getBlock);
			const getType = computed(() => getBlock().type);
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
		get errors() {
			return getErrors();
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
		get vapor() {
			return getVapor();
		},
	};

	function useParseTemplateResult(base: IRBlock) {
		return computed<{
			snapshot: IScriptSnapshot;
			template: string;
			errors: CompilerDOM.CompilerError[];
			warnings: CompilerDOM.CompilerError[];
			result?: TemplateCompileResult;
			compiler?: TemplateCompiler;
		}>(lastResult => {
			if (lastResult?.template === base.content) {
				return lastResult;
			}

			// incremental update
			if (
				lastResult?.result && lastResult.compiler?.update
				&& !lastResult.errors.length
				&& !lastResult.warnings.length
			) {
				const change = getUntrackedSnapshot().getChangeRange(lastResult.snapshot);
				if (change) {
					const pausedSub = setActiveSub(undefined);
					const templateOffset = base.offset;
					setActiveSub(pausedSub);

					const newText = getUntrackedSnapshot().getText(change.span.start, change.span.start + change.newLength);
					const newResult = lastResult.compiler.update(lastResult.result, {
						start: change.span.start - templateOffset,
						end: change.span.start - templateOffset + change.span.length,
						newText,
					});
					if (newResult) {
						return {
							snapshot: getUntrackedSnapshot(),
							template: base.content,
							result: newResult,
							compiler: lastResult.compiler,
							errors: [],
							warnings: [],
						};
					}
				}
			}

			const errors: CompilerDOM.CompilerError[] = [];
			const warnings: CompilerDOM.CompilerError[] = [];
			const options: CompilerDOM.CompilerOptions = {
				onError: err => errors.push(err),
				onWarn: err => warnings.push(err),
				expressionPlugins: ['typescript'],
			};

			try {
				const compiled = pipeline.compileTemplate(base.lang, base.content, options);
				if (compiled) {
					return {
						snapshot: getUntrackedSnapshot(),
						template: base.content,
						result: compiled.result,
						compiler: compiled.compiler,
						errors,
						warnings,
					};
				}
			}
			catch (e) {
				return {
					snapshot: getUntrackedSnapshot(),
					template: base.content,
					errors: [e as CompilerDOM.CompilerError],
					warnings,
				};
			}

			return {
				snapshot: getUntrackedSnapshot(),
				template: base.content,
				errors,
				warnings,
			};
		});
	}

	function useNullableBlock<T extends VueFormatBlock, K extends IRBlock>(
		name: string,
		getBlock: () => T | undefined,
		resolve: (block: () => T, base: IRBlock) => K,
	) {
		const hasBlock = computed(() => !!getBlock());
		return computed<K | undefined>(() => {
			if (!hasBlock()) {
				return;
			}
			const _block = computed(() => getBlock()!);
			return resolve(_block, useBlock(name, _block));
		});
	}

	function useBlock(
		name: string,
		getBlock: () => VueFormatBlock,
	) {
		const getLang = computed(() => {
			const { lang } = getBlock();
			if (typeof lang !== 'string') {
				throw new TypeError(`The format gave the block '${name}' no \`lang\`.`);
			}
			return lang;
		});
		const getContent = computed(() => getBlock().content);
		const getOffset = computed(() => getBlock().offset);
		const getElementStart = computed(() => getBlock().element?.start);
		const getElementEnd = computed(() => getBlock().element?.end);
		const getElement = computed(() => {
			const start = getElementStart();
			return start === undefined ? undefined : { start, end: getElementEnd()! };
		});
		return {
			name,
			get lang() {
				return getLang();
			},
			get content() {
				return getContent();
			},
			get offset() {
				return getOffset();
			},
			get element() {
				return getElement();
			},
		};
	}
}

function mergeObject<T, K>(a: T, b: K): T & K {
	return Object.defineProperties(a, Object.getOwnPropertyDescriptors(b)) as T & K;
}
