import * as CompilerDOM from '@vue/compiler-dom';
import {
	completionFeatures,
	directiveCommentRE,
	type IRBlock,
	type TemplateBlockScope,
	type TemplateBlockScopeOwner,
	type TemplateScope,
	type VueCodeMarker,
} from '@vue/language-core';
import { type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy } from '../../../protocol';
import { Boundary, isSynthesizedIgnore, OpenRanges, type TsCode } from '../../boundary';
import { names } from '../names';
import { asType, endOfLine, isTsLang, newLine, typeAliasRef } from '../utils';

export type TemplateCodegenContext = ReturnType<typeof createTemplateCodegenContext>;

export function createTemplateCodegenContext(scriptLang: string, templateScope: TemplateScope) {
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

	function* generateDiagnosticDirectiveStart(): Generator<TsCode> {
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

	function* generateDiagnosticDirectiveEnd(): Generator<TsCode> {
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

	function* generateDiagnosticDirectiveComment(directive: DiagnosticDirectiveMapping): Generator<TsCode> {
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
	function* generateWithDiagnosticDirectiveRanges(code: TsCode): Generator<TsCode> {
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
	function getMarker(code: TsCode) {
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

	function* generateDiagnosticDirectiveRangesEnd(): Generator<TsCode> {
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

	// template scope -------------------------------------------------------------

	/** The scope analysis of an expression; the code generation of every expression reads it from language-core. */
	function getExpression(block: IRBlock, start: number, code: string) {
		const expression = templateScope.expressions.get(block)?.get(start);
		if (expression?.code !== code) {
			throw new Error(`The template scope has no expression \`${code}\` at offset ${start} of ${block.name}.`);
		}
		return expression;
	}

	const blockScopes: TemplateBlockScope[] = [];
	const memberFeatures = new Map<string, Map<number, VueCodeMarker>>();

	function enterBlockScope(owner: TemplateBlockScopeOwner) {
		const scope = templateScope.blockScopes.get(owner);
		if (!scope) {
			throw new Error(`The template scope has no block scope of the node.`);
		}
		blockScopes.push(scope);
	}

	function isDeclared(name: string) {
		return blockScopes.some(scope => scope.declared.has(name));
	}

	/** The features of the code of a reference, which its member in the block scope maps with for completion. */
	function setMemberFeatures(block: IRBlock, offset: number, features: VueCodeMarker) {
		let blockFeatures = memberFeatures.get(block.name);
		if (!blockFeatures) {
			memberFeatures.set(block.name, blockFeatures = new Map());
		}
		if (!blockFeatures.has(offset)) {
			blockFeatures.set(offset, features);
		}
	}

	/**
	 * A block scope gathers the template identifiers within it as members of
	 * `__VLS_scope`; completion is mapped only on those members.
	 */
	function* exitBlockScope(): Generator<TsCode> {
		const scope = blockScopes.pop()!;
		const completionMembers = scope.members
			.map(member => [member, memberFeatures.get(member.block)?.get(member.offset)] as const)
			.filter(([, features]) => features && features.features & completionFeatures);
		if (!completionMembers.length) {
			return;
		}
		generatedTypes.add(names.Scope);
		// Only referenced locals are listed: a type query reads the variable,
		// which would hide its unused diagnostic.
		let type = typeAliasRef(names.Scope, scriptLang);
		if (scope.locals.length) {
			type += ` & { ${scope.locals.map(name => `${name}: typeof ${name}`).join(`; `)} }`;
		}
		yield `{${newLine}`;
		yield `const ${names.scope} = ${asType(type, scriptLang)}${endOfLine}`;
		yield `[`;
		for (const [{ block, offset, sourceName }, features] of completionMembers) {
			// The completion of a member lists the members of the scope whatever its name, so the edges of each
			// identifier map around `constructor`, which resolves on any object without being listed, instead of a
			// name the scope may not have.
			yield `${names.scope}.`;
			yield [``, block, offset, features!];
			yield `constructor`;
			yield [``, block, offset + sourceName.length, features!];
			yield `,`;
		}
		yield `]${endOfLine}`;
		yield `}${newLine}`;
	}

	// context accesses -----------------------------------------------------------

	// Ordered log of the names the generated code reads from the setup bindings or the template context;
	// event-handler closures slice from a mark to find the names accessed within their body.
	const accessLog: string[] = [];

	// conditions -----------------------------------------------------------------

	// Active branch conditions with the names each accessed; the guards are
	// replayed inside inline-handler closures.
	const conditions: { text: string; accesses: string[] }[] = [];

	function* generateConditionGuards() {
		for (const condition of conditions) {
			if (condition.accesses.length && condition.accesses.every(isDeclared)) {
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
		getExpression,
		enterBlockScope,
		exitBlockScope,
		isDeclared,
		setMemberFeatures,
		accessLog,
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
