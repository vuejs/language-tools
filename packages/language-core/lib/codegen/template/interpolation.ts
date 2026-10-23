import { replaceRange } from 'muggle-string';
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
	const generated: Code[] = [];
	const identifierStarts = new Map<number, number>();
	const identifierEnds = new Map<number, number>();
	const functionMark = ctx.functionScopes.length;
	if (prefix) {
		generated.push(prefix);
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
			generated.push(...generateNonIdentifierCode(
				code.slice(prevEnd, offset + name.length),
				block.name,
				start + prevEnd,
				features,
				prevEnd > 0,
			));
			generated.push(`: `);
		}
		else if (prevEnd < offset) {
			generated.push(...generateNonIdentifierCode(
				code.slice(prevEnd, offset),
				block.name,
				start + prevEnd,
				features,
				prevEnd > 0,
			));
		}

		const codes: Code[] = [[
			name,
			block.name,
			start + offset,
			isShorthand
				? { ...features, __shorthandExpression: 'js' as const }
				: features,
		]];

		identifierStarts.set(start + offset, generated.length);
		generated.push(...generateIdentifier(
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
		identifierEnds.set(start + offset + name.length, generated.length);

		prevEnd = offset + name.length;
	}

	if (prevEnd < code.length) {
		generated.push(...generateNonIdentifierCode(
			code.slice(prevEnd),
			block.name,
			start + prevEnd,
			features,
			prevEnd > 0,
		));
	}

	if (suffix) {
		generated.push(suffix);
	}
	const insertions: { index: number; offset: number; codes: Code[] }[] = [];
	for (const scope of ctx.functionScopes.splice(functionMark)) {
		const body = scope.functionBody!;
		const bodyStart = start + body.start - prefix.length;
		const bodyEnd = start + body.end - prefix.length;
		const assertions = [...scope.reasserts].map(name =>
			`${names.withDotValue}(${name}, ${getRefBrandArgument(options.vueCompilerOptions, options.scriptLang)})${
				body.isBlock ? endOfLine : ', '
			}`
		).join('');
		const opening: Code[] = [`${body.isBlock ? newLine : ''}${assertions}`];
		if (!body.isBlock) {
			// Return-type errors can span the parentheses or the whole comma expression.
			const bodyFeatures = { verification: features.verification };
			const expressionFeatures = { ...bodyFeatures, __combineToken: Symbol() };
			opening.unshift(
				['(', block.name, bodyStart, bodyFeatures],
				['', block.name, bodyStart, expressionFeatures],
			);
			insertions.push({
				...toGeneratedPosition(bodyEnd, identifierEnds),
				codes: [
					['', block.name, bodyEnd, expressionFeatures],
					[')', block.name, bodyEnd - 1, bodyFeatures],
				],
			});
		}
		insertions.push({
			...toGeneratedPosition(bodyStart, identifierStarts),
			codes: opening,
		});
	}
	for (const insertion of insertions.reverse().sort((a, b) => b.index - a.index || b.offset - a.offset)) {
		const { index, offset, codes } = insertion;
		if (offset === 0) {
			generated.splice(index, 0, ...codes);
		}
		else {
			// Replace within one chunk so adjacent zero-length boundary mappings survive.
			const chunk = [generated[index]!];
			replaceRange(chunk, offset, offset, ...codes);
			generated.splice(index, 1, ...chunk);
		}
	}
	yield* generated;

	function toGeneratedPosition(sourceOffset: number, identifiers: Map<number, number>) {
		const identifierIndex = identifiers.get(sourceOffset);
		if (identifierIndex !== undefined) {
			return { index: identifierIndex, offset: 0 };
		}
		for (const [index, code] of generated.entries()) {
			if (
				typeof code !== 'string' && code[1] === block.name && code[2] <= sourceOffset
				&& sourceOffset <= code[2] + code[0].length
			) {
				return { index, offset: sourceOffset - code[2] };
			}
		}
		return { index: generated.length, offset: 0 };
	}
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
	reassertBindings?: Set<string>;
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
		if (options.reassertBindings?.has(name)) {
			for (let i = ctx.scopes.length - 1; i >= 0; i--) {
				const scope = ctx.scopes[i]!;
				if (scope.functionBody) {
					scope.reasserts.add(name);
					break;
				}
			}
		}
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
