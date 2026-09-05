import * as CompilerDOM from '@vue/compiler-dom';
import type { Code, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';
import type { InlayHintInfo } from '../inlayHints';
import { endOfLine, newLine } from '../utils';

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
		ignoreErrorNode?: CompilerDOM.CommentNode;
		expectError?: {
			node: CompilerDOM.CommentNode;
		};
		diagnosticDirectives?: {
			directive: NonNullable<VueCodeInformation['__diagnosticDirective']>['directive'];
			originalStart: number;
		}[];
		diagnosticDirectiveEnded?: boolean;
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
						info.ignoreErrorNode = comment;
						break;
					}
					case 'expect-error': {
						info.expectError = {
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
		for (
			const [policy, directiveNode] of [
				['ignore', info.ignoreErrorNode],
				['expect', info.expectError?.node],
			] as const
		) {
			if (!directiveNode) {
				continue;
			}
			(info.diagnosticDirectives ??= []).push({
				directive: {
					policy,
					originalLength: directiveNode.loc.end.offset - directiveNode.loc.start.offset,
				},
				originalStart: directiveNode.loc.start.offset,
			});
		}
		stack.push(info);
		return true;
	}

	function* generateDiagnosticDirectiveStart(): Generator<Code> {
		const info = stack.at(-1);
		for (const directive of info?.diagnosticDirectives ?? []) {
			yield diagnosticDirectiveMarker(directive, 'anchor');
		}
	}

	function* generateDiagnosticDirectiveEnd(): Generator<Code> {
		const info = stack.at(-1);
		if (!info || info.diagnosticDirectiveEnded) {
			return;
		}
		info.diagnosticDirectiveEnded = true;
		const hasIgnore = info.diagnosticDirectives?.some(
			directive => directive.directive.policy === 'ignore',
		);
		for (const directive of info.diagnosticDirectives ?? []) {
			if (directive.directive.policy === 'expect' && !hasIgnore) {
				yield diagnosticDirectiveMarker(directive, 'end');
			}
		}
	}

	function* exit(): Generator<Code> {
		stack.pop();
		commentBuffer.length = 0;
	}

	function resolveCodeFeatures(features: VueCodeInformation): VueCodeInformation {
		if (features.verification && stack.length) {
			const data = stack[stack.length - 1]!;
			if (data.ignoreError) {
				const directive = data.diagnosticDirectives?.find(
					info => info.directive.policy === 'ignore',
				);
				return {
					...features,
					verification: false,
					__diagnosticDirective: directive && {
						directive: directive.directive,
						phase: 'content',
					},
				};
			}
			if (data.expectError !== undefined) {
				const directive = data.diagnosticDirectives?.find(
					info => info.directive.policy === 'expect',
				);
				return {
					...features,
					verification: {
						shouldReport: () => false,
					},
					__diagnosticDirective: directive && {
						directive: directive.directive,
						phase: 'content',
					},
				};
			}
		}
		return features;
	}

	function diagnosticDirectiveMarker(
		info: NonNullable<typeof stack[number]['diagnosticDirectives']>[number],
		phase: NonNullable<VueCodeInformation['__diagnosticDirective']>['phase'],
	): Code {
		return [
			'',
			'template',
			info.originalStart,
			{
				__diagnosticDirective: {
					directive: info.directive,
					phase,
				},
			},
		];
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
	const dotValueAccesses = new Set<string>();

	// Ordered log of accessed names; event-handler closures slice from a mark
	// to find the names accessed within their body.
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
				if (!reservedWords.has(varName)) {
					for (const offset of offsets) {
						yield [varName, source, offset, codeFeatures.importCompletionOnly];
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

	function* generateHoistVariables() {
		// trick to avoid TS 4081 (#5186)
		if (hoistVars.size) {
			yield `var `;
			let first = true;
			for (const [originalVar, hoistVar] of hoistVars) {
				if (!first) {
					yield `, `;
				}
				first = false;
				yield `${hoistVar} = ${originalVar}!`;
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
		generateDiagnosticDirectiveStart,
		generateDiagnosticDirectiveEnd,
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
