import { SpanMapFeature, SpanMapKind } from '@volar/language-core';
import {
	type CodeSource,
	completionFeatures,
	type IRBlock,
	type TemplateReference,
	type VueCodeMarker,
	type VueCompilerOptions,
} from '@vue/language-core';
import { createSourceRewrite, type Piece, type RewriteOrigin, type Source } from 'muggle-string';
import { names } from '../names';
import { Boundary, mapped, type TsCode, type TsCodeData, type TsPiece } from '../tsCode';
import { getRefBrandArgument, isTsLang } from '../writers';
import type { TemplateCodegenContext } from './context';

/**
 * The code of the expression `code` at `start` of `block`: a rewrite of `code` that replaces its references with their
 * accesses. The ranges of `omit` (offsets in `code`, sorted and disjoint) generate no code; the references inside them
 * are skipped. The code out of references in the ranges of `noRename` (sorted and disjoint too) takes no rename.
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
	noRename: readonly (readonly [start: number, end: number])[] = [],
): Generator<TsCode> {
	if (prefix) {
		yield prefix;
	}

	const memberFeatures: VueCodeMarker = { features: features.features & completionFeatures };
	const featuresWithoutCompletion: VueCodeMarker = {
		...features,
		features: features.features & ~completionFeatures,
	};

	const references = ctx.getExpression(block, start, code).references;
	/**
	 * The offsets of the runs of code between the references, but the first.
	 * The first char of each maps without features: adjacent mappings share the boundary offset (closed interval), so
	 * both the end of the token before and the start of the run claim it, and rename / navigation would fire on the
	 * neighbouring token.
	 */
	const runStarts: number[] = [];

	const expression = { content: code };
	const rewrite = createSourceRewrite<Source, { data: TsCodeData }>(expression);
	for (const [omitStart, omitEnd] of omit) {
		rewrite.replace(omitStart, omitEnd, '');
	}

	let prevEnd = 0;
	for (const reference of references) {
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
		addRun(prevEnd, offset);
		prevEnd = offset + name.length;
		if (omitted) {
			if (name) {
				rewrite.replace(offset, prevEnd, '');
			}
			continue;
		}

		const identifierFeatures = member ? featuresWithoutCompletion : features;
		if (local || (isShorthand && options.setupConsts.has(name))) {
			replaceReference(offset, prevEnd, mapped(name, block, start + offset, identifierFeatures));
			continue;
		}
		const marker = isShorthand ? { ...identifierFeatures, kind: SpanMapKind.Atom } : identifierFeatures;

		const codes: TsCode[] = isShorthand ? [mapped(name, block, start + offset, marker), `: `] : [];
		codes.push(...generateIdentifier(
			options,
			ctx,
			[mapped(name, block, start + offset, marker)],
			reference,
			block,
			start + offset,
			start + prevEnd,
		));
		replaceReference(offset, prevEnd, codes);
	}
	addRun(prevEnd, code.length);

	const pieces: TsCode[] = [];
	const sink = (piece: Piece<RewriteOrigin<Source, { data: TsCodeData }>>) => {
		pieces.push(
			typeof piece !== 'string' && piece.source === expression
				? mapped(code.slice(piece.start, piece.end), block, start + piece.start, piece.data as VueCodeMarker)
				: piece as TsPiece,
		);
	};
	// the kept code renders by views, which give the features of its ranges
	const runStartFeatures: VueCodeMarker = { features: 0 };
	const noRenameFeatures: VueCodeMarker = { ...features, features: features.features & ~SpanMapFeature.Rename };
	let viewEnd = 0;
	let runIndex = 0;
	const renderView = (end: number, data: VueCodeMarker) => {
		// an empty expression renders its inserts too
		if (viewEnd < end || !code.length) {
			rewrite.render(viewEnd, end, sink, { data });
			viewEnd = end;
		}
	};
	const renderUntil = (end: number, data: VueCodeMarker) => {
		end = Math.min(end, code.length);
		for (; runIndex < runStarts.length && runStarts[runIndex]! < end; runIndex++) {
			renderView(runStarts[runIndex]!, data);
			renderView(runStarts[runIndex]! + 1, runStartFeatures);
		}
		renderView(end, data);
	};
	for (const [rangeStart, rangeEnd] of noRename) {
		renderUntil(rangeStart, features);
		renderUntil(rangeEnd, noRenameFeatures);
	}
	renderUntil(code.length, features);
	yield* pieces;

	if (suffix) {
		yield suffix;
	}

	/**
	 * Replaces the reference at `from`..`to` with `codes`. A reference of no char, which a parse error gives, maybe
	 * past the end of `code`, inserts them.
	 */
	function replaceReference(from: number, to: number, codes: TsCode | TsCode[]) {
		if (from < to) {
			rewrite.replace(from, to, codes);
		}
		else {
			rewrite.writer(0).insertBefore(Math.min(from, code.length), codes);
		}
	}

	function addRun(from: number, to: number) {
		if (from > 0 && from < to) {
			runStarts.push(from);
		}
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
// - dotValue bindings (narrowed at least once anywhere) → `.value` of the wrapper
//   that shadows the binding in the template function, at every position;
//   narrowing then works on the `.value` reference chain
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
			// the template function links the source to the binding without reading it;
			// the tuple keeps a `const` enum from being the type of an expression (TS2475).
			ctx.bindingReferences.push(
				...isTsLang(options.scriptLang)
					? [`void ({} as unknown as [typeof `, ...codes, `]);\n`]
					: [`void /** @type {[typeof `, ...codes, `]} */ (/** @type {unknown} */ ({}));\n`],
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
