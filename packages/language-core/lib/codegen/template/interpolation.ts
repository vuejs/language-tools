import type * as ts from 'typescript';
import type { Code, IRBlock, VueCodeInformation, VueCompilerOptions } from '../../types';
import { getNodeText, getStartEnd } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { endOfLine, getRefBrandArgument, getTypeScriptAST, identifierRE, newLine } from '../utils';
import { Boundary } from '../utils/boundary';
import { forEachDeclarations, shouldIdentifierSkipped } from './bindingReferences';
import type { TemplateCodegenContext } from './context';

export function* generateInterpolation(
	options: IdentifierOptions & {
		typescript: typeof import('typescript');
		reassertBindings?: Set<string>;
	},
	ctx: TemplateCodegenContext,
	block: IRBlock,
	features: VueCodeInformation,
	code: string,
	start: number,
	prefix: string = '',
	suffix: string = '',
	inNarrowing: boolean = false,
): Generator<Code> {
	if (prefix) {
		yield prefix;
	}

	// Assertion narrowing does not flow into functions for imports and `let`/`var`
	// bindings (TS limitation), so each function body re-asserts the ones it reads.
	// Bodies are buffered until their end, when those reads are known.
	const bodies = options.reassertBindings?.size && !identifierRE.test(code)
		? collectFunctionBodies(options.typescript, getTypeScriptAST(options.typescript, block, prefix + code + suffix))
			.map(body => ({ ...body, start: body.start - prefix.length, end: body.end - prefix.length }))
		: [];
	// Exits precede enters at the same offset; the stable sort keeps the inner exit and the outer enter first.
	const marks = [
		...bodies.map(body => ({ offset: body.end, body, enter: false })).reverse(),
		...bodies.map(body => ({ offset: body.start, body, enter: true })),
	].sort((a, b) => a.offset - b.offset);
	const frames: { isBlock: boolean; codes: Code[]; reasserts: Set<string> }[] = [];
	let markIndex = 0;

	function* write(codes: Iterable<Code>): Generator<Code> {
		if (frames.length) {
			frames[frames.length - 1]!.codes.push(...codes);
		}
		else {
			yield* codes;
		}
	}

	function* generateCodeUntil(from: number, end: number): Generator<Code> {
		while (markIndex < marks.length && marks[markIndex]!.offset <= end) {
			const { offset, body, enter } = marks[markIndex++]!;
			yield* write(generateNonIdentifierCode(code.slice(from, offset), block.name, start + from, features, from > 0));
			from = offset;
			if (enter) {
				frames.push({ isBlock: body.isBlock, codes: [], reasserts: new Set() });
			}
			else {
				yield* write(generateFunctionBody(frames.pop()!));
			}
		}
		yield* write(generateNonIdentifierCode(code.slice(from, end), block.name, start + from, features, from > 0));
	}

	function* generateFunctionBody({ isBlock, codes, reasserts }: typeof frames[number]): Generator<Code> {
		if (!reasserts.size) {
			yield* codes;
			return;
		}
		yield isBlock ? newLine : `{${newLine}`;
		for (const name of reasserts) {
			yield `${names.withDotValue}(${name}, ${
				getRefBrandArgument(options.vueCompilerOptions, options.scriptLang)
			})${endOfLine}`;
		}
		if (isBlock) {
			yield* codes;
		}
		else {
			yield `return (`;
			yield* codes;
			yield `)${endOfLine}}`;
		}
	}

	let prevEnd = 0;
	for (
		const [name, offset, isShorthand, isNarrowing, inTypeQuery, isNewOperand] of forEachIdentifiers(
			options.typescript,
			ctx,
			block,
			code,
			prefix,
			suffix,
			inNarrowing,
		)
	) {
		if (isShorthand) {
			yield* generateCodeUntil(prevEnd, offset + name.length);
			yield* write([`: `]);
		}
		else {
			yield* generateCodeUntil(prevEnd, offset);
		}

		if (
			frames.length
			&& options.reassertBindings!.has(name)
			&& !options.setupConsts.has(name)
			&& !options.setupRefs.has(name)
			&& !shouldIdentifierSkipped(ctx, name)
		) {
			frames[frames.length - 1]!.reasserts.add(name);
		}

		const codes: Code[] = [[
			name,
			block.name,
			start + offset,
			isShorthand
				? { ...features, __shorthandExpression: 'js' as const }
				: features,
		]];

		yield* write(generateIdentifier(
			options,
			ctx,
			codes,
			name,
			block.name,
			start + offset,
			start + offset + name.length,
			isNarrowing,
			inTypeQuery,
			isNewOperand,
		));

		prevEnd = offset + name.length;
	}

	yield* generateCodeUntil(prevEnd, code.length);

	if (suffix) {
		yield suffix;
	}
}

// Bodies in pre-order; a block body spans between its braces.
function collectFunctionBodies(ts: typeof import('typescript'), ast: ts.SourceFile) {
	const bodies: { start: number; end: number; isBlock: boolean }[] = [];
	const visit = (node: ts.Node) => {
		if (
			(ts.isArrowFunction(node)
				|| ts.isFunctionExpression(node)
				|| ts.isFunctionDeclaration(node)
				|| ts.isMethodDeclaration(node)
				|| ts.isGetAccessorDeclaration(node)
				|| ts.isSetAccessorDeclaration(node)
				|| ts.isConstructorDeclaration(node)
				|| ts.isClassStaticBlockDeclaration(node))
			&& node.body
		) {
			const { start, end } = getStartEnd(ts, node.body, ast);
			const isBlock = ts.isBlock(node.body);
			if (!isBlock || node.body.statements.length) {
				bodies.push({ start: isBlock ? start + 1 : start, end: isBlock ? end - 1 : end, isBlock });
			}
		}
		ts.forEachChild(node, visit);
	};
	ts.forEachChild(ast, visit);
	return bodies;
}

/**
 * Yield a code chunk, cutting the boundary character off as verification-only.
 *
 * Adjacent mappings share the boundary offset (closed interval), so both the
 * neighbouring token's end and this chunk's start claim the same source offset.
 * Downgrading the boundary character to verification-only keeps content-sensitive
 * features (rename / navigation) from firing on the neighbouring chunk.
 */
function* generateNonIdentifierCode(
	code: string,
	source: string,
	offset: number,
	data: VueCodeInformation,
	shouldCut = true,
): Generator<Code> {
	if (!code.length) {
		return;
	}
	if (!shouldCut) {
		yield [code, source, offset, data];
		return;
	}
	yield [code.slice(0, 1), source, offset, { verification: data.verification }];
	if (code.length > 1) {
		yield [code.slice(1), source, offset + 1, data];
	}
}

interface IdentifierOptions {
	setupRefs: Set<string>;
	setupConsts: Set<string>;
	setupBindings: Set<string>;
	dotValueBindings: Set<string>;
	vueCompilerOptions: VueCompilerOptions;
	scriptLang: string;
}

// Access strategy, in precedence order:
// - setup consts → direct reference
// - local-scope / global names → direct reference (the interpolation path
//   filters these earlier; the v-bind shorthand path relies on this branch)
// - template refs → direct `.value`
// - dotValue bindings (narrowed at least once anywhere) → `.value` at
//   every position; narrowing then works on the `.value` reference chain
// - other bindings → `__VLS_unwrap` (plain reads keep the original type)
// - otherwise → `__VLS_ctx.<name>`
export function* generateIdentifier(
	options: IdentifierOptions,
	ctx: TemplateCodegenContext,
	codes: Iterable<Code>,
	name: string,
	source: string,
	start: number,
	end: number,
	isNarrowing = false,
	inTypeQuery = false,
	isNewOperand = false,
): Generator<Code> {
	if (options.setupConsts.has(name) || shouldIdentifierSkipped(ctx, name)) {
		yield* codes;
	}
	else if (options.setupRefs.has(name)) {
		yield* codes;
		yield `.`;
		const boundary = yield* Boundary.start(
			source,
			start,
			end,
			codeFeatures.verification,
		);
		yield `value`;
		yield boundary.end();
	}
	else if (options.setupBindings.has(name)) {
		// First pass records narrowing accesses here; the second pass emits from dotValueBindings.
		ctx.accessVariable(source, name, start, inTypeQuery || isNarrowing);
		if (inTypeQuery || options.dotValueBindings.has(name)) {
			yield* codes;
			yield `.`;
			const boundary = yield* Boundary.start(
				source,
				start,
				end,
				codeFeatures.verification,
			);
			yield `value`;
			yield boundary.end();
		}
		else {
			// `new __VLS_unwrap(Foo)()` parses as `new (__VLS_unwrap(Foo)())`,
			// whose target lacks a construct signature; keep the operand parenthesized.
			if (isNewOperand) {
				yield `(`;
			}
			yield `${names.unwrap}(`;
			yield* codes;
			yield `, ${getRefBrandArgument(options.vueCompilerOptions, options.scriptLang)})`;
			if (isNewOperand) {
				yield `)`;
			}
		}
	}
	else {
		// #1205, #1264
		const boundary = yield* Boundary.start(
			source,
			start,
			end,
			codeFeatures.verification,
		);
		if (ctx.dollarVars.has(name)) {
			yield names.dollars;
		}
		else {
			ctx.accessVariable(source, name, start);
			yield names.ctx;
		}
		yield `.`;
		yield* codes;
		yield boundary.end();
	}
}

function* forEachIdentifiers(
	ts: typeof import('typescript'),
	ctx: TemplateCodegenContext,
	block: IRBlock,
	code: string,
	prefix: string,
	suffix: string,
	inNarrowing: boolean,
): Generator<IdentifierAccess> {
	if (identifierRE.test(code) && !shouldIdentifierSkipped(ctx, code)) {
		yield [code, 0, false, inNarrowing, false, false];
		return;
	}

	const scope = ctx.scope();
	const ast = getTypeScriptAST(ts, block, prefix + code + suffix);
	for (
		const { id, isShorthand, isNarrowing, skipped, inTypeQuery, isNewOperand } of forEachDeclarations(
			ts,
			ast,
			ast,
			ctx,
			scope,
			inNarrowing,
		)
	) {
		if (skipped) {
			continue;
		}
		const text = getNodeText(ts, id, ast);
		yield [text, getStartEnd(ts, id, ast).start - prefix.length, isShorthand, isNarrowing, inTypeQuery, isNewOperand];
	}
	scope.end();
}

type IdentifierAccess = [
	name: string,
	offset: number,
	isShorthand: boolean,
	isNarrowing: boolean,
	inTypeQuery: boolean,
	isNewOperand: boolean,
];
