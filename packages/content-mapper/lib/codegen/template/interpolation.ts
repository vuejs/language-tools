import { SpanMapFeature, SpanMapKind } from '@volar/language-core';
import {
	type CodeSource,
	completionFeatures,
	type IRBlock,
	type TemplateReference,
	type VueCodeMarker,
	type VueCompilerOptions,
} from '@vue/language-core';
import { names } from '../names';
import { Boundary, mapped, type MappedPiece, type TsCode } from '../tsCode';
import { getRefBrandArgument, isTsLang } from '../writers';
import type { TemplateCodegenContext } from './context';

/**
 * The code of the expression `code` at `start` of `block`. The ranges of `omit` (offsets in `code`, sorted and
 * disjoint) generate no code; the references inside them are skipped. The code out of references in the ranges of
 * `renamedElsewhere` (sorted and disjoint too) takes no rename, which another copy of the same source takes.
 */
export function* generateInterpolation(
	options: IdentifierOptions,
	ctx: TemplateCodegenContext,
	block: IRBlock,
	features: VueCodeMarker,
	code: string,
	start: number,
	prefix: string = '',
	suffix: string = '',
	omit: readonly (readonly [start: number, end: number])[] = [],
	renamedElsewhere: readonly (readonly [start: number, end: number])[] = [],
): Generator<TsCode> {
	if (prefix) {
		yield prefix;
	}

	const memberFeatures: VueCodeMarker = { features: features.features & completionFeatures };
	const featuresWithoutCompletion: VueCodeMarker = {
		...features,
		features: features.features & ~completionFeatures,
	};

	function* generateCodeUntil(from: number, to: number): Generator<TsCode> {
		if (from < to) {
			yield* omitRanges(
				withoutRename(
					generateNonIdentifierCode(code.slice(from, to), block, start + from, features, from > 0),
					start,
					renamedElsewhere,
				),
				start,
				omit,
			);
		}
	}

	let prevEnd = 0;
	for (const reference of ctx.getExpression(block, start, code).references) {
		const { name, offset, isShorthand, local, member } = reference;
		const omitted = omit.some(([omitStart, omitEnd]) => omitStart <= offset && offset < omitEnd);
		if (member && !omitted) {
			if (local) {
				ctx.accessLog.push(name);
			}
			ctx.setMemberFeatures(block, start + offset, memberFeatures);
		}
		if (local && !member) {
			continue;
		}
		yield* generateCodeUntil(prevEnd, offset);
		prevEnd = offset + name.length;
		if (omitted) {
			continue;
		}

		const identifierFeatures = member ? featuresWithoutCompletion : features;
		if (local || (isShorthand && options.setupConsts.has(name))) {
			yield mapped(name, block, start + offset, identifierFeatures);
			continue;
		}
		const marker = isShorthand ? { ...identifierFeatures, kind: SpanMapKind.Atom } : identifierFeatures;
		if (isShorthand) {
			yield mapped(name, block, start + offset, marker);
			yield `: `;
		}

		const codes: TsCode[] = [mapped(name, block, start + offset, marker)];

		yield* generateIdentifier(
			options,
			ctx,
			codes,
			reference,
			block,
			start + offset,
			start + offset + name.length,
		);
	}

	yield* generateCodeUntil(prevEnd, code.length);

	if (suffix) {
		yield suffix;
	}
}

/** The parts of the source `pieces` of an expression at `start` out of the ranges of `omit`. */
function* omitRanges(
	pieces: Generator<MappedPiece<VueCodeMarker>>,
	start: number,
	omit: readonly (readonly [start: number, end: number])[],
): Generator<TsCode> {
	for (const { text, source, start: offset, end, data } of pieces) {
		let kept = offset;
		for (const [omitStart, omitEnd] of omit) {
			if (start + omitEnd <= kept || start + omitStart >= end) {
				continue;
			}
			if (kept < start + omitStart) {
				yield mapped(text.slice(kept - offset, start + omitStart - offset), source, kept, data);
			}
			kept = start + omitEnd;
		}
		if (kept < end) {
			yield mapped(text.slice(kept - offset), source, kept, data);
		}
	}
}

/** The parts of the source `pieces` of an expression at `start`, without rename in the ranges of `ranges`. */
function* withoutRename(
	pieces: Generator<MappedPiece<VueCodeMarker>>,
	start: number,
	ranges: readonly (readonly [start: number, end: number])[],
): Generator<MappedPiece<VueCodeMarker>> {
	for (const { text, source, start: offset, end, data } of pieces) {
		let kept = offset;
		for (const [rangeStart, rangeEnd] of ranges) {
			const from = Math.max(start + rangeStart, kept);
			const to = Math.min(start + rangeEnd, end);
			if (from >= to) {
				continue;
			}
			if (kept < from) {
				yield mapped(text.slice(kept - offset, from - offset), source, kept, data);
			}
			yield mapped(text.slice(from - offset, to - offset), source, from, {
				...data,
				features: data.features & ~SpanMapFeature.Rename,
			});
			kept = to;
		}
		if (kept < end) {
			yield mapped(text.slice(kept - offset), source, kept, data);
		}
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
	source: CodeSource,
	offset: number,
	data: VueCodeMarker,
	shouldCut = true,
): Generator<MappedPiece<VueCodeMarker>> {
	if (!code.length) {
		return;
	}
	if (!shouldCut) {
		yield mapped(code, source, offset, data);
		return;
	}
	yield mapped(code.slice(0, 1), source, offset, { features: 0 });
	if (code.length > 1) {
		yield mapped(code.slice(1), source, offset + 1, data);
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
// - locals and globals of the template scope → direct reference (the interpolation
//   path filters these earlier; the v-bind shorthand path relies on this branch)
// - template refs → direct `.value`
// - dotValue bindings (narrowed at least once anywhere) → `.value` at
//   every position; narrowing then works on the `.value` reference chain
// - other bindings → `__VLS_unwrap` (plain reads keep the original type)
// - otherwise → `__VLS_ctx.<name>`
export function* generateIdentifier(
	options: IdentifierOptions,
	ctx: TemplateCodegenContext,
	codes: Iterable<TsCode>,
	{ name, local, inTypeQuery, isNewOperand }: TemplateReference,
	source: CodeSource,
	start: number,
	end: number,
): Generator<TsCode> {
	if (options.setupConsts.has(name) || local) {
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
		ctx.accessBinding(name);
		if (inTypeQuery || options.dotValueBindings.has(name)) {
			// The template reads a wrapper that shadows the binding. A type query outside
			// the template function links the source to the binding without reading it.
			ctx.bindingReferences.push(
				...isTsLang(options.scriptLang)
					? [`void ({} as unknown as typeof `, ...codes, `);\n`]
					: [`void /** @type {typeof `, ...codes, `} */ (/** @type {unknown} */ ({}));\n`],
			);
			const boundary = yield* Boundary.start(source, start, end, { features: 0 });
			yield `${name}.value`;
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
			ctx.accessLog.push(name);
			yield names.ctx;
		}
		yield `.`;
		yield* codes;
		yield boundary.end();
	}
}
