import { shouldReportDiagnostics } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import type { Code, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';
import type { InlayHintInfo } from '../inlayHints';
import { endOfLine, newLine } from '../utils';
import { Boundary } from '../utils/boundary';

export type TemplateCodegenContext = ReturnType<typeof createTemplateCodegenContext>;

const directiveCommentRegex = /^<!--\s*@vue-(?<name>[-\w]+)\b(?<content>[\s\S]*)-->$/;

export function createTemplateCodegenContext() {
	// directive comments ---------------------------------------------------------

	const stack: {
		ignoreError?: boolean;
		expectError?: {
			token: number;
			node: CompilerDOM.CommentNode;
		};
		generic?: {
			content: string;
			offset: number;
		};
	}[] = [];
	const commentBuffer: CompilerDOM.CommentNode[] = [];

	function getCommentInfo() {
		return stack[stack.length - 1]!;
	}

	function enter(
		node:
			| CompilerDOM.RootNode
			| CompilerDOM.TemplateChildNode
			| CompilerDOM.SimpleExpressionNode,
	) {
		if (node.type === CompilerDOM.NodeTypes.COMMENT) {
			commentBuffer.push(node);
			return false;
		}

		const info: typeof stack[number] = {};
		const comments = [...commentBuffer];
		commentBuffer.length = 0;

		for (const comment of comments) {
			const match = comment.loc.source.match(directiveCommentRegex);
			if (match) {
				const { name, content } = match.groups!;
				switch (name) {
					case 'skip': {
						return false;
					}
					case 'ignore': {
						info.ignoreError = true;
						break;
					}
					case 'expect-error': {
						info.expectError = {
							token: 0,
							node: comment,
						};
						break;
					}
					case 'generic': {
						const text = content!.trim();
						if (text.startsWith('{') && text.endsWith('}')) {
							info.generic = {
								content: text.slice(1, -1),
								offset: comment.loc.start.offset + comment.loc.source.indexOf('{') + 1,
							};
						}
						break;
					}
				}
			}
		}
		stack.push(info);
		return true;
	}

	function* exit(): Generator<Code> {
		const info = stack.pop()!;
		commentBuffer.length = 0;
		if (info.expectError !== undefined) {
			const boundary = yield* Boundary.start(
				'template',
				info.expectError.node.loc.start.offset,
				{
					verification: {
						shouldReport: () => info.expectError!.token === 0,
					},
				},
			);
			yield `// @ts-expect-error`;
			yield boundary.end(info.expectError.node.loc.end.offset);
			yield `${newLine}${endOfLine}`;
		}
	}

	function resolveCodeFeatures(features: VueCodeInformation): VueCodeInformation {
		if (features.verification && stack.length) {
			const data = stack[stack.length - 1]!;
			if (data.ignoreError) {
				return {
					...features,
					verification: false,
				};
			}
			if (data.expectError !== undefined) {
				return {
					...features,
					verification: {
						shouldReport: (source, code) => {
							if (shouldReportDiagnostics(features, source, code)) {
								data.expectError!.token++;
							}
							return false;
						},
					},
				};
			}
		}
		return features;
	}

	// internal variables ---------------------------------------------------------

	let variableId = 0;

	function getInternalVariable() {
		return `__VLS_${variableId++}`;
	}

	// scopes ---------------------------------------------------------------------

	class Scope extends Set<string> {
		declare(...variables: string[]) {
			for (const name of variables) {
				this.add(name);
			}
		}

		end() {
			scopes.pop();
			return generateAutoImport();
		}
	}

	const scopes: Scope[] = [];

	function scope() {
		const scope = new Scope();
		scopes.push(scope);
		return scope;
	}

	// context accesses -----------------------------------------------------------

	const contextAccesses = new Map<string, Map<string, Set<number>>>();

	function accessVariable(source: string, name: string, offset?: number) {
		let map = contextAccesses.get(name);
		if (!map) {
			contextAccesses.set(name, map = new Map());
		}
		let arr = map.get(source);
		if (!arr) {
			map.set(source, arr = new Set());
		}
		if (offset !== undefined) {
			arr.add(offset);
		}
	}

	function* generateAutoImport(): Generator<Code> {
		const all = [...contextAccesses.entries()];
		if (!all.some(([, offsets]) => offsets.size)) {
			return;
		}
		yield `// @ts-ignore${newLine}`; // #2304
		yield `[`;
		for (const [varName, map] of all) {
			for (const [source, offsets] of map) {
				for (const offset of offsets) {
					yield [varName, source, offset, codeFeatures.importCompletionOnly];
					yield `,`;
				}
				offsets.clear();
			}
		}
		yield `]${endOfLine}`;
	}

	// conditions -----------------------------------------------------------------

	const conditions: string[] = [];

	function* generateConditionGuards() {
		for (const condition of conditions) {
			yield `if (!${condition}) throw 0${endOfLine}`;
		}
	}

	// hoist vars -----------------------------------------------------------------

	const hoistVars = new Map<string, string>();

	function getHoistVariable(originalVar: string) {
		let name = hoistVars.get(originalVar);
		if (name === undefined) {
			hoistVars.set(originalVar, name = `__VLS_${variableId++}`);
		}
		return name;
	}

	function* generateHoistVariables() {
		// trick to avoid TS 4081 (#5186)
		if (hoistVars.size) {
			yield `// @ts-ignore${newLine}`;
			yield `var `;
			for (const [originalVar, hoistVar] of hoistVars) {
				yield `${hoistVar} = ${originalVar}, `;
			}
			yield endOfLine;
		}
	}

	// template refs --------------------------------------------------------------

	const templateRefs = new Map<string, { typeExp: string; offset: number }[]>();

	function addTemplateRef(name: string, typeExp: string, offset: number) {
		let refs = templateRefs.get(name);
		if (!refs) {
			templateRefs.set(name, refs = []);
		}
		refs.push({ typeExp, offset });
	}

	// others ---------------------------------------------------------------------

	const components: (() => string)[] = [];
	const dollarVars = new Set<string>();
	const inlayHints: InlayHintInfo[] = [];
	const generatedTypes = new Set<string>();
	const inheritedAttrVars = new Set<string>();
	const singleRootElTypes = new Set<string>();
	const singleRootNodes = new Set<CompilerDOM.ElementNode | null>();
	const slots: {
		name: string;
		offset?: number;
		tagRange: [number, number];
		propsVar: string;
	}[] = [];
	const dynamicSlots: { expVar: string; propsVar: string }[] = [];

	return {
		getCommentInfo,
		enter,
		exit,
		resolveCodeFeatures,
		getInternalVariable,
		scopes,
		scope,
		contextAccesses,
		accessVariable,
		generateAutoImport,
		conditions,
		generateConditionGuards,
		hoistVars,
		getHoistVariable,
		generateHoistVariables,
		templateRefs,
		addTemplateRef,
		components,
		dollarVars,
		inlayHints,
		generatedTypes,
		inheritedAttrVars,
		singleRootElTypes,
		singleRootNodes,
		slots,
		dynamicSlots,
		inVFor: false,
	};
}
