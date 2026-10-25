import { SpanMapKind } from '@volar/language-core';
import type { Code, IRBlock, TypeScript, VueCodeMarker, VueCompilerOptions } from '../../types';
import { getNodeText, getStartEnd } from '../../utils/shared';
import { getTypeScriptAST } from '../../utils/typescriptAST';
import { completionFeatures } from '../features';
import { names } from '../names';
import { getRefBrandArgument, identifierRE } from '../utils';
import { Boundary } from '../utils/boundary';
import { forEachDeclarations, shouldIdentifierSkipped } from './bindingReferences';
import type { TemplateCodegenContext } from './context';

export function* generateInterpolation(
	options: IdentifierOptions & {
		typescript: TypeScript;
	},
	ctx: TemplateCodegenContext,
	block: IRBlock,
	features: VueCodeMarker,
	code: string,
	start: number,
	prefix: string = '',
	suffix: string = '',
	inNarrowing: boolean = false,
): Generator<Code> {
	if (prefix) {
		yield prefix;
	}

	const memberFeatures: VueCodeMarker = { features: features.features & completionFeatures };
	const featuresWithoutCompletion: VueCodeMarker = {
		...features,
		features: features.features & ~completionFeatures,
	};

	let prevEnd = 0;
	for (
		const [name, offset, isShorthand, isNarrowing, inTypeQuery, isNewOperand, skipped] of forEachIdentifiers(
			options.typescript,
			ctx,
			block,
			code,
			prefix,
			suffix,
			inNarrowing,
		)
	) {
		const isMember = ctx.recordScopeMember(name, block.name, start + offset, memberFeatures);
		if (skipped && !isMember) {
			continue;
		}
		if (prevEnd < offset) {
			yield* generateNonIdentifierCode(
				code.slice(prevEnd, offset),
				block.name,
				start + prevEnd,
				features,
				prevEnd > 0,
			);
		}
		prevEnd = offset + name.length;

		const identifierFeatures = isMember ? featuresWithoutCompletion : features;
		if (skipped) {
			yield [name, block.name, start + offset, identifierFeatures];
			continue;
		}
		const marker = isShorthand ? { ...identifierFeatures, kind: SpanMapKind.Atom } : identifierFeatures;
		if (isShorthand) {
			yield [name, block.name, start + offset, marker];
			yield `: `;
		}

		const codes: Code[] = [[name, block.name, start + offset, marker]];

		yield* generateIdentifier(
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
		);
	}

	if (prevEnd < code.length) {
		yield* generateNonIdentifierCode(
			code.slice(prevEnd),
			block.name,
			start + prevEnd,
			features,
			prevEnd > 0,
		);
	}

	if (suffix) {
		yield suffix;
	}
}

/**
 * Yield a code chunk, cutting the boundary character off as diagnostics-only.
 *
 * Adjacent mappings share the boundary offset (closed interval), so both the
 * neighbouring token's end and this chunk's start claim the same source offset.
 * Downgrading the boundary character to diagnostics-only keeps content-sensitive
 * features (rename / navigation) from firing on the neighbouring chunk.
 */
function* generateNonIdentifierCode(
	code: string,
	source: string,
	offset: number,
	data: VueCodeMarker,
	shouldCut = true,
): Generator<Code> {
	if (!code.length) {
		return;
	}
	if (!shouldCut) {
		yield [code, source, offset, data];
		return;
	}
	yield [
		code.slice(0, 1),
		source,
		offset,
		{ features: 0 },
	];
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
			{ features: 0 },
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
				{ features: 0 },
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
			{ features: 0 },
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
	ts: TypeScript,
	ctx: TemplateCodegenContext,
	block: IRBlock,
	code: string,
	prefix: string,
	suffix: string,
	inNarrowing: boolean,
): Generator<IdentifierAccess> {
	if (identifierRE.test(code)) {
		yield [code, 0, false, inNarrowing, false, false, shouldIdentifierSkipped(ctx, code)];
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
		const text = getNodeText(id, ast);
		yield [
			text,
			getStartEnd(id, ast).start - prefix.length,
			isShorthand,
			isNarrowing,
			inTypeQuery,
			isNewOperand,
			skipped,
		];
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
	skipped: boolean,
];
