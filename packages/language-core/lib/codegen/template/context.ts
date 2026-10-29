import { shouldReportDiagnostics } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import type { Code, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';
import type { InlayHintInfo } from '../inlayHints';
import { names } from '../names';
import { endOfLine, isTsLang, newLine } from '../utils';
import { Boundary } from '../utils/boundary';
import { generateCamelized } from '../utils/camelized';

export type TemplateCodegenContext = ReturnType<typeof createTemplateCodegenContext>;

const directiveCommentRE = /^<!--\s*@vue-(?<name>[-\w]+)\b(?<content>[\s\S]*)-->$/;

// Reserved words can never be auto-imported bindings, and emitting them as
// bare array elements is a syntax error (#5267: `[class,]`).
const reservedWords = new Set([
	'arguments',
	'await',
	'break',
	'case',
	'catch',
	'class',
	'const',
	'continue',
	'debugger',
	'default',
	'delete',
	'do',
	'else',
	'enum',
	'eval',
	'export',
	'extends',
	'false',
	'finally',
	'for',
	'function',
	'if',
	'implements',
	'import',
	'in',
	'instanceof',
	'interface',
	'let',
	'new',
	'null',
	'package',
	'private',
	'protected',
	'public',
	'return',
	'static',
	'super',
	'switch',
	'this',
	'throw',
	'true',
	'try',
	'typeof',
	'var',
	'void',
	'while',
	'with',
	'yield',
]);

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

	/** Per name and source, the offsets of the accesses and their source text, which may be the hyphenated name. */
	const contextAccesses = new Map<string, Map<string, Map<number, string>>>();
	const dotValueAccesses = new Set<string>();

	// Ordered log of accessed names; event-handler closures slice from a mark
	// to find the names accessed within their body.
	const accessLog: string[] = [];

	// Names accessed outside the generated functions that re-assert their bindings.
	const topLevelAccesses = new Set<string>();
	let functionDepth = 0;

	function enterFunction() {
		functionDepth++;
	}

	function exitFunction() {
		functionDepth--;
	}

	function accessVariable(source: string, name: string, offset?: number, dotValue = false, sourceName = name) {
		accessLog.push(name);
		if (!functionDepth) {
			topLevelAccesses.add(name);
		}
		let map = contextAccesses.get(name);
		if (!map) {
			contextAccesses.set(name, map = new Map());
		}
		let arr = map.get(source);
		if (!arr) {
			map.set(source, arr = new Map());
		}
		if (offset !== undefined) {
			arr.set(offset, sourceName);
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
				if (!reservedWords.has(varName)) {
					for (const [offset, sourceName] of offsets) {
						yield* generateCamelized(sourceName, source, offset, codeFeatures.importCompletionOnly);
						yield `,`;
					}
				}
				offsets.clear();
			}
		}
		yield `]${endOfLine}`;
	}

	// conditions -----------------------------------------------------------------

	// Active branch conditions with the names each accessed; the guards are
	// replayed inside inline-handler closures.
	const conditions: { text: string; accesses: string[] }[] = [];

	function* generateConditionGuards() {
		for (const condition of conditions) {
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

	function* generateHoistVariables(scriptLang: string) {
		// trick to avoid TS 4081 (#5186)
		if (hoistVars.size) {
			// non-null assertions are TS-only syntax (TS8013 in JS)
			const isTs = isTsLang(scriptLang);
			yield `var `;
			let first = true;
			for (const [originalVar, hoistVar] of hoistVars) {
				if (!first) {
					yield `, `;
				}
				first = false;
				yield isTs
					? `${hoistVar} = ${originalVar}!`
					: `${hoistVar} = ${names.nonNull}(${originalVar})`;
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
		topLevelAccesses,
		enterFunction,
		exitFunction,
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
