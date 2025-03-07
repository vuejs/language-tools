import type * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { InlayHintInfo } from '../inlayHints';
import { endOfLine, newLine } from '../utils';
import type { TemplateCodegenOptions } from './index';

export type TemplateCodegenContext = ReturnType<typeof createTemplateCodegenContext>;

export function createTemplateCodegenContext(options: Pick<TemplateCodegenOptions, 'scriptSetupBindingNames'>) {
	let lastGenericComment: {
		content: string;
		offset: number;
	} | undefined;
	let variableId = 0;

	const hoistVars = new Map<string, string>();
	const localVars = new Map<string, number>();
	const dollarVars = new Set<string>();
	const accessExternalVariables = new Map<string, Set<number>>();
	const slots: {
		name: string;
		offset?: number;
		tagRange: [number, number];
		nodeLoc: any;
		propsVar: string;
	}[] = [];
	const dynamicSlots: {
		expVar: string;
		propsVar: string;
	}[] = [];
	const blockConditions: string[] = [];
	const scopedClasses: {
		source: string;
		className: string;
		offset: number;
	}[] = [];
	const emptyClassOffsets: number[] = [];
	const inlayHints: InlayHintInfo[] = [];
	const bindingAttrLocs: CompilerDOM.SourceLocation[] = [];
	const inheritedAttrVars = new Set<string>();
	const templateRefs = new Map<string, {
		typeExp: string;
		offset: number;
	}>();

	return {
		slots,
		dynamicSlots,
		dollarVars,
		accessExternalVariables,
		lastGenericComment,
		blockConditions,
		scopedClasses,
		emptyClassOffsets,
		inlayHints,
		bindingAttrLocs,
		inheritedAttrVars,
		templateRefs,
		currentComponent: undefined as {
			ctxVar: string;
			used: boolean;
		} | undefined,
		singleRootElTypes: [] as string[],
		singleRootNodes: new Set<CompilerDOM.ElementNode | null>(),
		accessExternalVariable(name: string, offset?: number) {
			let arr = accessExternalVariables.get(name);
			if (!arr) {
				accessExternalVariables.set(name, arr = new Set());
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
		getHoistVariable: (originalVar: string) => {
			let name = hoistVars.get(originalVar);
			if (name === undefined) {
				hoistVars.set(originalVar, name = `__VLS_${variableId++}`);
			}
			return name;
		},
		generateHoistVariables: function* () {
			// trick to avoid TS 4081 (#5186)
			if (hoistVars.size) {
				yield `// @ts-ignore${newLine}`;
				yield `var `;
				for (const [originalVar, hoistVar] of hoistVars) {
					yield `${hoistVar} = ${originalVar}, `;
				}
				yield endOfLine;
			}
		},
		generateConditionGuards: function* () {
			for (const condition of blockConditions) {
				yield `if (!${condition}) return${endOfLine}`;
			}
		},
		generateAutoImportCompletion: function* (): Generator<Code> {
			const all = [...accessExternalVariables.entries()];
			if (!all.some(([_, offsets]) => offsets.size)) {
				return;
			}
			yield `// @ts-ignore${newLine}`; // #2304
			yield `[`;
			for (const [varName, offsets] of all) {
				for (const offset of offsets) {
					if (options.scriptSetupBindingNames.has(varName)) {
						// #3409
						yield [
							varName,
							'template',
							offset,
							{
								...codeFeatures.additionalCompletion,
								...codeFeatures.withoutHighlightAndCompletionAndNavigation,
							},
						];
					}
					else {
						yield [
							varName,
							'template',
							offset,
							codeFeatures.additionalCompletion,
						];
					}
					yield `,`;
				}
				offsets.clear();
			}
			yield `]${endOfLine}`;
		}
	};
}
