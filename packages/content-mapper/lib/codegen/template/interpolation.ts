import { SpanMapFeature, SpanMapKind } from '@volar/language-core';
import {
	type CodeSource,
	completionFeatures,
	type IRBlock,
	type TemplateReference,
	type TypeScript,
	type VueCodeMarker,
	type VueCompilerOptions,
} from '@vue/language-core';
import { getStartEnd } from '@vue/language-core/lib/typescript/nodes';
import { getTypeScriptAST } from '@vue/language-core/lib/typescript/typescriptAST';
import { createSourceRewrite, type Piece, type RewriteOrigin, type RewriteWriter, type Source } from 'muggle-string';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import { names } from '../names';
import { Boundary, mapped, type TsCode, type TsCodeData, type TsPiece } from '../tsCode';
import { endOfLine, getRefBrandArgument, newLine } from '../writers';
import type { TemplateCodegenContext } from './context';

/**
 * The code of the expression `code` at `start` of `block`: a rewrite of `code` that replaces its references with their
 * accesses. The ranges of `omit` (offsets in `code`, sorted and disjoint) generate no code; the references inside them
 * are skipped. The code out of references in the ranges of `noRename` (sorted and disjoint too) takes no rename.
 */
export function* generateInterpolation(
	options: IdentifierOptions & {
		typescript?: TypeScript;
		reassertBindings?: Set<string>;
	},
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

	// Assertion narrowing does not flow into functions for imports and `let`/`var`
	// bindings (TS limitation), so each function body re-asserts the ones it reads.
	// Parameter defaults run before the body, so each one that reads such a binding
	// re-asserts it in an immediately invoked arrow, whose flow stays in the function.
	const references = ctx.getExpression(block, start, code).references;
	const bodies = options.typescript && options.reassertBindings?.size
			&& references.some(({ name, local }) => !local && options.reassertBindings!.has(name))
		? collectFunctionBodies(options.typescript, getTypeScriptAST(options.typescript, block, prefix + code + suffix))
			.map(body => ({ ...body, start: body.start - prefix.length, end: body.end - prefix.length }))
		: [];
	// Exits precede enters at the same offset; the stable sort keeps the inner exit and the outer enter first.
	const marks = [
		...bodies.map(body => ({ offset: body.end, body, enter: false })).reverse(),
		...bodies.map(body => ({ offset: body.start, body, enter: true })),
	].sort((a, b) => a.offset - b.offset);
	/** The bindings that each function body re-asserts, of the bodies entered and not left. */
	const frames: Set<string>[] = [];
	const reasserts = new Map<FunctionBody, Set<string>>();
	let markIndex = 0;
	/**
	 * The offsets of the runs of code between the references and the bounds of the function bodies, but the first.
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
			ctx.setMemberFeatures(block, start + offset, memberFeatures);
		}
		if (local && !member) {
			continue;
		}
		skipUntil(prevEnd, offset);
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

		if (
			frames.length
			&& options.reassertBindings!.has(name)
			&& !options.setupConsts.has(name)
			&& !options.setupRefs.has(name)
		) {
			frames[frames.length - 1]!.add(name);
		}

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
	skipUntil(prevEnd, code.length);

	// a body sits inside the bodies before it, so its rank is lower: their code goes outside its own at one offset
	for (const [index, body] of bodies.entries()) {
		const bindings = reasserts.get(body);
		if (bindings?.size) {
			wrapFunctionBody(rewrite.writer(bodies.length - index), body, bindings);
		}
	}

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
	 * past the end of `code`, inserts them, inside the code of the function bodies that open there.
	 */
	function replaceReference(from: number, to: number, codes: TsCode | TsCode[]) {
		if (from < to) {
			rewrite.replace(from, to, codes);
		}
		else {
			rewrite.writer(0).insertBefore(Math.min(from, code.length), codes);
		}
	}

	function skipUntil(from: number, end: number) {
		while (markIndex < marks.length && marks[markIndex]!.offset <= end) {
			const { offset, body, enter } = marks[markIndex++]!;
			addRun(from, offset);
			from = offset;
			if (enter) {
				const bindings = new Set<string>();
				frames.push(bindings);
				reasserts.set(body, bindings);
			}
			else {
				frames.pop();
			}
		}
		addRun(from, end);
	}

	function addRun(from: number, to: number) {
		if (from > 0 && from < to) {
			runStarts.push(from);
		}
	}

	// Diagnostics reported on the generated call, or on the `return` keyword (where TS reports
	// return type mismatches), map back to the original expression.
	function wrapFunctionBody(
		writer: RewriteWriter<Source, { data: TsCodeData }>,
		body: FunctionBody,
		bindings: Set<string>,
	) {
		const brand = getRefBrandArgument(options.vueCompilerOptions, options.scriptLang);
		const reassertCodes = [...bindings].map(name => `${names.withDotValue}(${name}, ${brand})${endOfLine}`);
		if (body.kind === 'block') {
			writer.insertBefore(body.start, [newLine, ...reassertCodes]);
		}
		else if (body.kind === 'parameter') {
			const [boundaryStart, boundary] = Boundary.open(block, start + body.start, start + body.end, { features: 0 });
			writer.insertBefore(body.start, [boundaryStart, `(() => {${newLine}`, ...reassertCodes, `return (`]);
			writer.insertAfter(body.end, [`)${endOfLine}})()`, boundary.end()]);
		}
		else {
			const [boundaryStart, boundary] = Boundary.open(block, start + body.start, start + body.end, { features: 0 });
			writer.insertBefore(body.start, [`{${newLine}`, ...reassertCodes, boundaryStart, `return`, boundary.end(), ` (`]);
			writer.insertAfter(body.end, `)${endOfLine}}`);
		}
	}
}

interface FunctionBody {
	start: number;
	end: number;
	kind: 'block' | 'expression' | 'parameter';
}

// Function scopes in pre-order: the expressions a parameter list evaluates, then the body.
// A block body spans from after its directive prologue to its closing brace.
function collectFunctionBodies(ts: TypeScript, ast: ts.SourceFile) {
	const bodies: FunctionBody[] = [];
	const pushParameterExpression = (node: ts.Expression) => {
		const { start, end } = getStartEnd(node, ast);
		bodies.push({ start, end, kind: 'parameter' });
		visit(node);
	};
	const visitBinding = (name: ts.BindingName) => {
		if (ts.isIdentifier(name)) {
			return;
		}
		for (const element of name.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (element.propertyName && ts.isComputedPropertyName(element.propertyName)) {
				pushParameterExpression(element.propertyName.expression);
			}
			if (element.name) {
				visitBinding(element.name);
			}
			if (element.initializer) {
				pushParameterExpression(element.initializer);
			}
		}
	};
	function visit(node: ts.Node): undefined {
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
			if (!ts.isClassStaticBlockDeclaration(node)) {
				for (const modifier of node.modifiers ?? []) {
					visit(modifier);
				}
				if (!ts.isArrowFunction(node) && !ts.isConstructorDeclaration(node) && node.name) {
					visit(node.name);
				}
				for (const typeParameter of node.typeParameters ?? []) {
					visit(typeParameter);
				}
				for (const parameter of node.parameters) {
					for (const modifier of parameter.modifiers ?? []) {
						visit(modifier);
					}
					visitBinding(parameter.name);
					if (parameter.type) {
						visit(parameter.type);
					}
					if (parameter.initializer) {
						pushParameterExpression(parameter.initializer);
					}
				}
				if (node.type) {
					visit(node.type);
				}
			}
			const { start, end } = getStartEnd(node.body, ast);
			if (ts.isBlock(node.body)) {
				const statements = node.body.statements;
				const prologue = statements.findIndex(statement =>
					!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)
				);
				if (prologue !== -1) {
					bodies.push({
						start: prologue ? statements[prologue - 1]!.end : start + 1,
						end: end - 1,
						kind: 'block',
					});
				}
			}
			else {
				bodies.push({ start, end, kind: 'expression' });
			}
			visit(node.body);
			return;
		}
		node.forEachChild(visit);
	}
	ast.forEachChild(visit);
	return bodies;
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
			ctx.accessLog.push(name);
			yield names.ctx;
		}
		yield `.`;
		yield* codes;
		yield boundary.end();
	}
}
