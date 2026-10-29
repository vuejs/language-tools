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
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import { names } from '../names';
import { Boundary, type TsCode } from '../tsCode';
import { endOfLine, getRefBrandArgument, newLine } from '../writers';
import type { TemplateCodegenContext } from './context';

/**
 * The code of the expression `code` at `start` of `block`. The ranges of `omit` (offsets in `code`, sorted and
 * disjoint) generate no code; the references inside them are skipped. The code out of references in the ranges of
 * `renamedElsewhere` (sorted and disjoint too) takes no rename, which another copy of the same source takes.
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

	// Assertion narrowing does not flow into functions for imports and `let`/`var`
	// bindings (TS limitation), so each function body re-asserts the ones it reads.
	// Parameter defaults run before the body, so each one that reads such a binding
	// re-asserts it in an immediately invoked arrow, whose flow stays in the function.
	// Bodies are buffered until their end, when those reads are known.
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
	const frames: { body: typeof bodies[number]; codes: TsCode[]; reasserts: Set<string> }[] = [];
	let markIndex = 0;

	function* write(codes: Iterable<TsCode>): Generator<TsCode> {
		if (frames.length) {
			frames[frames.length - 1]!.codes.push(...codes);
		}
		else {
			yield* codes;
		}
	}

	function* generateSourceCode(from: number, to: number): Generator<TsCode> {
		yield* write(omitRanges(
			withoutRename(
				generateNonIdentifierCode(code.slice(from, to), block, start + from, features, from > 0),
				start,
				renamedElsewhere,
			),
			start,
			omit,
		));
	}

	function* generateCodeUntil(from: number, end: number): Generator<TsCode> {
		while (markIndex < marks.length && marks[markIndex]!.offset <= end) {
			const { offset, body, enter } = marks[markIndex++]!;
			yield* generateSourceCode(from, offset);
			from = offset;
			if (enter) {
				ctx.enterFunction();
				frames.push({ body, codes: [], reasserts: new Set() });
			}
			else {
				ctx.exitFunction();
				yield* write(generateFunctionBody(frames.pop()!));
			}
		}
		yield* generateSourceCode(from, end);
	}

	function* generateFunctionBody({ body, codes, reasserts }: typeof frames[number]): Generator<TsCode> {
		if (!reasserts.size) {
			yield* codes;
			return;
		}
		if (body.kind === 'block') {
			yield newLine;
			yield* generateReasserts(reasserts);
			yield* codes;
			return;
		}
		// Diagnostics reported on the generated call, or on the `return` keyword (where TS reports
		// return type mismatches), map back to the original expression.
		if (body.kind === 'parameter') {
			const boundary = yield* Boundary.start(block, start + body.start, start + body.end, { features: 0 });
			yield `(() => {${newLine}`;
			yield* generateReasserts(reasserts);
			yield `return (`;
			yield* codes;
			yield `)${endOfLine}})()`;
			yield boundary.end();
		}
		else {
			yield `{${newLine}`;
			yield* generateReasserts(reasserts);
			const boundary = yield* Boundary.start(block, start + body.start, start + body.end, { features: 0 });
			yield `return`;
			yield boundary.end();
			yield ` (`;
			yield* codes;
			yield `)${endOfLine}}`;
		}
	}

	function* generateReasserts(reasserts: Set<string>): Generator<TsCode> {
		for (const name of reasserts) {
			yield `${names.withDotValue}(${name}, ${
				getRefBrandArgument(options.vueCompilerOptions, options.scriptLang)
			})${endOfLine}`;
		}
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
		yield* generateCodeUntil(prevEnd, offset);
		prevEnd = offset + name.length;
		if (omitted) {
			continue;
		}

		const identifierFeatures = member ? featuresWithoutCompletion : features;
		if (local || (isShorthand && options.setupConsts.has(name))) {
			yield* write([[name, block, start + offset, identifierFeatures]]);
			continue;
		}
		const marker = isShorthand ? { ...identifierFeatures, kind: SpanMapKind.Atom } : identifierFeatures;
		if (isShorthand) {
			yield* write([[name, block, start + offset, marker], `: `]);
		}

		if (
			frames.length
			&& options.reassertBindings!.has(name)
			&& !options.setupConsts.has(name)
			&& !options.setupRefs.has(name)
		) {
			frames[frames.length - 1]!.reasserts.add(name);
		}

		const codes: TsCode[] = [[name, block, start + offset, marker]];

		yield* write(generateIdentifier(
			options,
			ctx,
			codes,
			reference,
			block,
			start + offset,
			start + offset + name.length,
		));
	}

	yield* generateCodeUntil(prevEnd, code.length);

	if (suffix) {
		yield suffix;
	}
}

// Function scopes in pre-order: the expressions a parameter list evaluates, then the body.
// A block body spans from after its directive prologue to its closing brace.
function collectFunctionBodies(ts: TypeScript, ast: ts.SourceFile) {
	const bodies: { start: number; end: number; kind: 'block' | 'expression' | 'parameter' }[] = [];
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

/** The parts of the source `segments` of an expression at `start` out of the ranges of `omit`. */
function* omitRanges(
	segments: Generator<[string, CodeSource, number, VueCodeMarker]>,
	start: number,
	omit: readonly (readonly [start: number, end: number])[],
): Generator<TsCode> {
	for (const [text, source, offset, data] of segments) {
		const end = offset + text.length;
		let kept = offset;
		for (const [omitStart, omitEnd] of omit) {
			if (start + omitEnd <= kept || start + omitStart >= end) {
				continue;
			}
			if (kept < start + omitStart) {
				yield [text.slice(kept - offset, start + omitStart - offset), source, kept, data];
			}
			kept = start + omitEnd;
		}
		if (kept < end) {
			yield [text.slice(kept - offset), source, kept, data];
		}
	}
}

/** The parts of the source `segments` of an expression at `start`, without rename in the ranges of `ranges`. */
function* withoutRename(
	segments: Generator<[string, CodeSource, number, VueCodeMarker]>,
	start: number,
	ranges: readonly (readonly [start: number, end: number])[],
): Generator<[string, CodeSource, number, VueCodeMarker]> {
	for (const segment of segments) {
		const [text, source, offset, data] = segment;
		const end = offset + text.length;
		let kept = offset;
		for (const [rangeStart, rangeEnd] of ranges) {
			const from = Math.max(start + rangeStart, kept);
			const to = Math.min(start + rangeEnd, end);
			if (from >= to) {
				continue;
			}
			if (kept < from) {
				yield [text.slice(kept - offset, from - offset), source, kept, data];
			}
			yield [
				text.slice(from - offset, to - offset),
				source,
				from,
				{ ...data, features: data.features & ~SpanMapFeature.Rename },
			];
			kept = to;
		}
		if (kept < end) {
			yield [text.slice(kept - offset), source, kept, data];
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
): Generator<[string, CodeSource, number, VueCodeMarker]> {
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
