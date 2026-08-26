import { shouldReportDiagnostics } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import type { Code, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';
import type { InlayHintInfo } from '../inlayHints';
import { endOfLine, newLine } from '../utils';
import { Boundary } from '../utils/boundary';

export type TemplateCodegenContext = ReturnType<typeof createTemplateCodegenContext>;

const directiveCommentRE = /^<!--\s*@vue-(?<name>[-\w]+)\b(?<content>[\s\S]*)-->$/;

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
			const match = comment.loc.source.match(directiveCommentRE);
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
				info.expectError.node.loc.end.offset,
				{
					verification: {
						shouldReport: () => info.expectError!.token === 0,
					},
				},
			);
			yield `// @ts-expect-error`;
			yield boundary.end();
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

	// Names of bindings used in narrowing positions (conditions, type guards,
	// write targets); the template codegen gives these a `.value` access at
	// every position and a single `__VLS_withDotValue` assertion at the top.
	const dotValueAccesses = new Set<string>();

	// Ordered log of accessed variable names; event-handler closures use slices
	// of it to find which bindings were accessed within the closure body.
	const accessLog: string[] = [];

	function accessVariable(source: string, name: string, offset?: number, dotValue = false) {
		accessLog.push(name);
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
		if (dotValue) {
			dotValueAccesses.add(name);
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

	// Generated text of each active branch condition, along with the names the
	// condition expression accessed. Condition guards are replayed inside
	// inline-handler closures, which re-assert the accessed bindings on demand.
	const conditions: { text: string; accesses: string[] }[] = [];

	function* generateConditionGuards() {
		for (const condition of conditions) {
			// The guard is replayed under the current scope chain; when every
			// accessed name is shadowed there (slot prop, v-for binding, ...),
			// the replay would test the shadowing locals instead of the
			// bindings the condition was generated from.
			if (condition.accesses.length && condition.accesses.every(name => scopes.some(scope => scope.has(name)))) {
				continue;
			}
			yield `if (!${condition.text}) throw 0${endOfLine}`;
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
		dotValueAccesses,
		accessLog,
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
