import type * as CompilerDOM from '@vue/compiler-dom';
import type { Code, VueCodeInformation } from '../../types';
import { endOfLine, newLine, wrapWith } from '../common';

const _codeFeatures = {
	all: {
		verification: true,
		completion: true,
		semantic: true,
		navigation: true,
	} as VueCodeInformation,
	verification: {
		verification: true,
	} as VueCodeInformation,
	completion: {
		completion: true,
	} as VueCodeInformation,
	additionalCompletion: {
		completion: { isAdditional: true },
	} as VueCodeInformation,
	navigation: {
		navigation: true,
	} as VueCodeInformation,
	navigationAndCompletion: {
		navigation: true,
	} as VueCodeInformation,
	withoutHighlight: {
		semantic: { shouldHighlight: () => false },
		verification: true,
		navigation: true,
		completion: true,
	} as VueCodeInformation,
	withoutHighlightAndCompletion: {
		semantic: { shouldHighlight: () => false },
		verification: true,
		navigation: true,
	} as VueCodeInformation,
	withoutHighlightAndCompletionAndNavigation: {
		semantic: { shouldHighlight: () => false },
		verification: true,
	} as VueCodeInformation,
};

export type TemplateCodegenContext = ReturnType<typeof createTemplateCodegenContext>;

export function createTemplateCodegenContext() {
	let ignoredError = false;
	let expectErrorToken: {
		errors: number;
		node: CompilerDOM.CommentNode;
	} | undefined;
	let variableId = 0;

	const codeFeatures = new Proxy(_codeFeatures, {
		get(target, key: keyof typeof _codeFeatures) {
			const data = target[key];
			if (data.verification) {
				if (ignoredError) {
					return {
						...data,
						verification: false,
					};
				}
				if (expectErrorToken) {
					const token = expectErrorToken;
					if (typeof data.verification !== 'object' || !data.verification.shouldReport) {
						return {
							...data,
							verification: {
								shouldReport: () => {
									token.errors++;
									return false;
								},
							},
						};
					}
				}
			}
			return data;
		},
	});
	const localVars = new Map<string, number>();
	const accessGlobalVariables = new Map<string, Set<number>>();
	const slots: {
		name: string;
		loc?: number;
		tagRange: [number, number];
		varName: string;
		nodeLoc: any;
	}[] = [];
	const dynamicSlots: {
		expVar: string;
		varName: string;
	}[] = [];
	const hasSlotElements = new Set<CompilerDOM.ElementNode>();;
	const blockConditions: string[] = [];
	const usedComponentCtxVars = new Set<string>();
	const scopedClasses: { className: string, offset: number; }[] = [];

	return {
		slots,
		dynamicSlots,
		codeFeatures,
		accessGlobalVariables,
		hasSlotElements,
		blockConditions,
		usedComponentCtxVars,
		scopedClasses,
		accessGlobalVariable(name: string, offset?: number) {
			let arr = accessGlobalVariables.get(name);
			if (!arr) {
				accessGlobalVariables.set(name, arr = new Set());
			}
			if (offset !== undefined) {
				arr.add(offset);
			}
		},
		hasLocalVariable: (name: string) => {
			return !!localVars.get(name);
		},
		addLocalVariable: (name: string) => {
			localVars.set(name, (localVars.get(name) ?? 0) + 1);
		},
		removeLocalVariable: (name: string) => {
			localVars.set(name, localVars.get(name)! - 1);
		},
		getInternalVariable: () => {
			return `__VLS_${variableId++}`;
		},
		ignoreError: function* (): Generator<Code> {
			if (!ignoredError) {
				ignoredError = true;
				yield `// @vue-ignore start${newLine}`;
			}
		},
		expectError: function* (prevNode: CompilerDOM.CommentNode): Generator<Code> {
			if (!expectErrorToken) {
				expectErrorToken = {
					errors: 0,
					node: prevNode,
				};
				yield `// @vue-expect-error start${newLine}`;
			}
		},
		resetDirectiveComments: function* (endStr: string): Generator<Code> {
			if (expectErrorToken) {
				const token = expectErrorToken;
				yield* wrapWith(
					expectErrorToken.node.loc.start.offset,
					expectErrorToken.node.loc.end.offset,
					{
						verification: {
							shouldReport: () => token.errors === 0,
						},
					},
					`// @ts-expect-error __VLS_TS_EXPECT_ERROR`,
				);
				yield `${newLine}${endOfLine}`;
				expectErrorToken = undefined;
				yield `// @vue-expect-error ${endStr}${newLine}`;
			}
			if (ignoredError) {
				ignoredError = false;
				yield `// @vue-ignore ${endStr}${newLine}`;
			}
		},
		generateAutoImportCompletion: function* (): Generator<Code> {
			const all = [...accessGlobalVariables.entries()];
			if (!all.some(([_, offsets]) => offsets.size)) {
				return;
			}
			yield `// @ts-ignore${newLine}`; // #2304
			yield `[`;
			for (const [varName, offsets] of all) {
				for (const offset of offsets) {
					yield [
						varName,
						'template',
						offset,
						codeFeatures.additionalCompletion,
					];
					yield `,`;
				}
				offsets.clear();
			}
			yield `]${endOfLine}`;
		}
	};
}
