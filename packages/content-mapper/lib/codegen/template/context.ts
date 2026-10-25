import * as CompilerDOM from '@vue/compiler-dom';
import {
	type Code,
	completionFeatures,
	type DiagnosticDirectiveMapping,
	DiagnosticDirectivePolicy,
	directiveCommentRE,
	type VueCodeMarker,
} from '@vue/language-core';
import { isLiteralWhitelisted } from '@vue/language-core/lib/utils/bindingReferences';
import { Boundary, isSynthesizedIgnore, OpenRanges } from '@vue/language-core/lib/utils/boundary';
import { names } from '../names';
import { asType, endOfLine, isTsLang, newLine } from '../utils';

export type TemplateCodegenContext = ReturnType<typeof createTemplateCodegenContext>;

export function createTemplateCodegenContext(scriptLang: string) {
	// directive comments ---------------------------------------------------------

	const stack: {
		ignoreError?: boolean;
		ignoreErrorNode?: CompilerDOM.CommentNode;
		expectError?: {
			node: CompilerDOM.CommentNode;
		};
		diagnosticDirectives?: DiagnosticDirectiveMapping[];
		diagnosticDirectiveBoundary?: [DiagnosticDirectiveMapping, Boundary];
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
				[DiagnosticDirectivePolicy.Ignore, info.ignoreErrorNode],
				[DiagnosticDirectivePolicy.Expect, info.expectError?.node],
			] as const
		) {
			if (directiveNode) {
				(info.diagnosticDirectives ??= []).push([
					directiveNode.loc.start.offset,
					directiveNode.loc.end.offset - directiveNode.loc.start.offset,
					0,
					0,
					policy,
				]);
			}
		}
		stack.push(info);
		return true;
	}

	function* generateDiagnosticDirectiveStart(): Generator<Code> {
		const info = stack.at(-1);
		const ignore = info?.diagnosticDirectives?.find(directive => directive[4] === DiagnosticDirectivePolicy.Ignore);
		for (const directive of info?.diagnosticDirectives ?? []) {
			yield* generateDiagnosticDirectiveComment(directive);
			const boundary = yield* Boundary.start('template', directive[0], directive[0], directive);
			// an expectation alongside an ignore stays empty
			if (ignore && directive !== ignore) {
				yield boundary.end();
			}
			else {
				info!.diagnosticDirectiveBoundary = [directive, boundary];
			}
		}
	}

	function* generateDiagnosticDirectiveEnd(): Generator<Code> {
		const info = stack.at(-1);
		if (!info || info.diagnosticDirectiveEnded) {
			return;
		}
		info.diagnosticDirectiveEnded = true;
		if (info.diagnosticDirectiveBoundary) {
			const [directive, boundary] = info.diagnosticDirectiveBoundary;
			// closed first, as the mapping after it already belongs to the range an ignore directive reopens
			yield boundary.end();
			yield* generateDiagnosticDirectiveComment(directive);
		}
	}

	function* generateDiagnosticDirectiveComment(directive: DiagnosticDirectiveMapping): Generator<Code> {
		// an empty mapping at the directive comment, which Volar's own features see
		yield ['', 'template', directive[0], { features: 0 }];
	}

	function exit() {
		stack.pop();
		commentBuffer.length = 0;
	}

	let reopenedInfo: typeof stack[number] | undefined;
	let reopenedBoundary: Boundary | undefined;

	/**
	 * The code a node generates after its end (an `else if` condition, the siblings in a `<template v-if>`)
	 * is still the node's, so its ignore directive covers that code with another range.
	 */
	function* generateWithDiagnosticDirectiveRanges(code: Code): Generator<Code> {
		const info = stack.at(-1);
		if (reopenedBoundary && reopenedInfo !== info) {
			yield* generateDiagnosticDirectiveRangesEnd();
		}
		const current = getMarker(code);
		if (
			current
			&& info?.diagnosticDirectiveEnded
			&& info.ignoreError
			&& !reopenedBoundary
			&& !synthesizedIgnores
		) {
			const ignore = info.diagnosticDirectives!.find(directive => directive[4] === DiagnosticDirectivePolicy.Ignore)!;
			reopenedInfo = info;
			reopenedBoundary = yield* Boundary.start('template', ignore[0], ignore[0], ignore);
		}
		yield code;
	}

	const openRanges = new OpenRanges<VueCodeMarker>();
	let synthesizedIgnores = 0;

	/** The data of a segment, or of the mapping range it bounds or maps as part of. */
	function getMarker(code: Code) {
		if (typeof code === 'string') {
			return;
		}
		const data = code[3];
		if (data === undefined) {
			return openRanges.mapping;
		}
		if ('start' in data) {
			if (Array.isArray(data.start)) {
				openRanges.start({ directive: data.start });
				if (isSynthesizedIgnore(data.start)) {
					synthesizedIgnores++;
				}
				return;
			}
			openRanges.start({ mapping: data.start });
			return data.start;
		}
		if ('end' in data) {
			const range = openRanges.end();
			if (range?.directive && isSynthesizedIgnore(range.directive)) {
				synthesizedIgnores--;
			}
			return range?.mapping;
		}
		return data;
	}

	function* generateDiagnosticDirectiveRangesEnd(): Generator<Code> {
		if (reopenedBoundary) {
			yield reopenedBoundary.end();
			reopenedInfo = reopenedBoundary = undefined;
		}
	}

	// internal variables ---------------------------------------------------------

	let variableId = 0;

	function getInternalVariable() {
		return `__VLS_${variableId++}`;
	}

	// scopes ---------------------------------------------------------------------

	class Scope extends Set<string> {
		/** Locals the generated code always reads, so listing them hides no unused diagnostic. */
		read = new Set<string>();
		/** The source name may be the hyphenated form of `name`. */
		members: [name: string, source: string, offset: number, features: VueCodeMarker, sourceName: string][] = [];

		declare(...variables: string[]) {
			for (const name of variables) {
				this.add(name);
			}
		}

		end() {
			scopes.pop();
		}
	}

	/**
	 * A block scope gathers the template identifiers within it as members of
	 * `__VLS_scope`; completion is mapped only on those members.
	 */
	class BlockScope extends Scope {
		override end() {
			super.end();
			return generateScopeMembers(this);
		}
	}

	const scopes: Scope[] = [];

	function scope() {
		const scope = new Scope();
		scopes.push(scope);
		return scope;
	}

	function blockScope() {
		const scope = new BlockScope();
		scopes.push(scope);
		return scope;
	}

	/**
	 * Returns false when the name is a local of the expression itself, which
	 * keeps its own completion.
	 */
	function recordScopeMember(
		name: string,
		source: string,
		offset: number,
		features: VueCodeMarker,
		sourceName = name,
	) {
		if (isLiteralWhitelisted(name) || name === 'require' || name.startsWith('__VLS_')) {
			return false;
		}
		for (let i = scopes.length - 1; i >= 0; i--) {
			const scope = scopes[i]!;
			if (scope instanceof BlockScope) {
				if (!scope.members.some(member => member[1] === source && member[2] === offset)) {
					scope.members.push([name, source, offset, features, sourceName]);
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
		const completionMembers = scope.members.filter(([, , , features]) => features.features & completionFeatures);
		if (!completionMembers.length) {
			return;
		}
		generatedTypes.add(names.Scope);
		// Only referenced locals are listed: a type query reads the variable,
		// which would hide its unused diagnostic.
		const locals = new Set([
			...scope.read,
			...[scope, ...scopes]
				.flatMap(scope => scope.members.map(([name]) => name))
				.filter(name => scope.has(name) || scopes.some(scope => scope instanceof BlockScope && scope.has(name))),
		]);
		let type = names.Scope;
		if (locals.size) {
			type += ` & { ${[...locals].map(name => `${name}: typeof ${name}`).join(`; `)} }`;
		}
		yield `{${newLine}`;
		yield `const ${names.scope} = ${asType(type, scriptLang)}${endOfLine}`;
		yield `[`;
		for (const [, source, offset, features, sourceName] of completionMembers) {
			// The completion of a member lists the members of the scope whatever its name, so the edges of each
			// identifier map around `constructor`, which resolves on any object without being listed, instead of a
			// name the scope may not have.
			yield `${names.scope}.`;
			yield [``, source, offset, features];
			yield `constructor`;
			yield [``, source, offset + sourceName.length, features];
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
			recordScopeMember(name, source, offset, { features: 0 }, sourceName);
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
		generateWithDiagnosticDirectiveRanges,
		generateDiagnosticDirectiveRangesEnd,
		getInternalVariable,
		scopes,
		scope,
		blockScope,
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
		generatedTypes,
		inheritedAttrVars,
		singleRootElTypes,
		singleRootNodes,
		slots,
		dynamicSlots,
		inVFor: false,
	};
}
