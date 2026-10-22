import * as CompilerDOM from '@vue/compiler-dom';
import type { Code, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';
import type { InlayHintInfo } from '../inlayHints';
import { names } from '../names';
import { asType, endOfLine, isTsLang, newLine } from '../utils';
import { generateCamelized } from '../utils/camelized';
import { isLiteralWhitelisted } from './bindingReferences';

export type TemplateCodegenContext = ReturnType<typeof createTemplateCodegenContext>;

const directiveCommentRE = /^<!--\s*@vue-(?<name>[-\w]+)\b(?<content>[\s\S]*)-->$/;

export function createTemplateCodegenContext(scriptLang: string) {
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

	function exit() {
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
		block = false;
		/** Locals the generated code always reads, so listing them hides no unused diagnostic. */
		read = new Set<string>();
		/** The source name may be the hyphenated form of `name`. */
		members: [name: string, source: string, offset: number, features: VueCodeInformation, sourceName: string][] = [];

		declare(...variables: string[]) {
			for (const name of variables) {
				this.add(name);
			}
		}

		end() {
			scopes.pop();
			return generateScopeMembers(this);
		}
	}

	const scopes: Scope[] = [];

	/**
	 * A block scope gathers the template identifiers within it as members of
	 * `__VLS_scope`; completion is mapped only on those members.
	 */
	function scope(block = false) {
		const scope = new Scope();
		scope.block = block;
		scopes.push(scope);
		return scope;
	}

	const scopeMemberNames = new Set<string>();

	/**
	 * Returns false when the name is a local of the expression itself, which
	 * keeps its own completion.
	 */
	function recordScopeMember(
		name: string,
		source: string,
		offset: number,
		features: VueCodeInformation,
		sourceName = name,
	) {
		if (isLiteralWhitelisted(name) || name === 'require' || name.startsWith('__VLS_')) {
			return false;
		}
		for (let i = scopes.length - 1; i >= 0; i--) {
			const scope = scopes[i]!;
			if (scope.block) {
				if (!scope.members.some(member => member[1] === source && member[2] === offset)) {
					scope.members.push([name, source, offset, features, sourceName]);
					scopeMemberNames.add(name);
				}
				return true;
			}
			if (scope.has(name)) {
				return false;
			}
		}
		return false;
	}

	function* generateScopeMembers(scope: Scope): Generator<Code> {
		if (!scope.members.length) {
			return;
		}
		generatedTypes.add(names.Scope);
		// Only referenced locals are listed: a type query reads the variable,
		// which would hide its unused diagnostic.
		const locals = new Set([
			...scope.read,
			...[scope, ...scopes]
				.flatMap(scope => scope.members.map(([name]) => name))
				.filter(name => scope.has(name) || scopes.some(scope => scope.block && scope.has(name))),
		]);
		let type = names.Scope;
		if (locals.size) {
			type += ` & { ${[...locals].map(name => `${name}: typeof ${name}`).join(`; `)} }`;
		}
		yield `{${newLine}`;
		yield `const ${names.scope} = ${asType(type, scriptLang)}${endOfLine}`;
		yield `// @ts-ignore${newLine}`; // #2304
		yield `[`;
		for (const [, source, offset, features, sourceName] of scope.members) {
			yield `${names.scope}.`;
			yield* generateCamelized(sourceName, source, offset, features);
			yield `,`;
		}
		yield `]${endOfLine}`;
		yield `}${newLine}`;
	}

	// context accesses -----------------------------------------------------------

	const contextAccesses = new Set<string>();
	const dotValueAccesses = new Set<string>();

	// Ordered log of accessed names; event-handler closures slice from a mark
	// to find the names accessed within their body.
	const accessLog: string[] = [];

	function accessVariable(source: string, name: string, offset?: number, dotValue = false, sourceName = name) {
		accessLog.push(name);
		contextAccesses.add(name);
		if (offset !== undefined) {
			recordScopeMember(name, source, offset, codeFeatures.importCompletionOnly, sourceName);
		}
		if (dotValue) {
			dotValueAccesses.add(name);
		}
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
		generateDiagnosticDirectiveStart,
		generateDiagnosticDirectiveEnd,
		exit,
		resolveCodeFeatures,
		getInternalVariable,
		scopes,
		scope,
		scopeMemberNames,
		recordScopeMember,
		contextAccesses,
		dotValueAccesses,
		accessLog,
		accessVariable,
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
