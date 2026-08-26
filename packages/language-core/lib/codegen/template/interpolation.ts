import type { Code, IRBlock, VueCodeInformation, VueCompilerOptions } from '../../types';
import { getNodeText, getStartEnd } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { getRefBrandArgument, getTypeScriptAST, identifierRE } from '../utils';
import { Boundary } from '../utils/boundary';
import { forEachDeclarations, shouldIdentifierSkipped } from './bindingReferences';
import type { TemplateCodegenContext } from './context';

export function* generateInterpolation(
	{
		typescript,
		destructuredProps,
		importedComponents,
		setupRefs,
		setupBindings,
		dotValueBindings,
		vueCompilerOptions,
	}: {
		typescript: typeof import('typescript');
		destructuredProps: Set<string>;
		importedComponents: Set<string>;
		setupRefs: Set<string>;
		setupBindings: Set<string>;
		dotValueBindings: Set<string>;
		vueCompilerOptions: VueCompilerOptions;
	},
	ctx: TemplateCodegenContext,
	block: IRBlock,
	data: VueCodeInformation,
	code: string,
	start: number,
	prefix: string = '',
	suffix: string = '',
	inNarrowing: boolean = false,
): Generator<Code> {
	if (prefix) {
		yield prefix;
	}

	let prevEnd = 0;
	for (
		const [name, offset, isShorthand, isNarrowing, inTypeQuery, isNewOperand] of forEachIdentifiers(
			typescript,
			ctx,
			block,
			code,
			prefix,
			suffix,
			inNarrowing,
		)
	) {
		const identifierData = isShorthand ? { ...data, __shorthandExpression: 'js' as const } : data;
		if (isShorthand) {
			yield* generateNonIdentifierCode(
				code.slice(prevEnd, offset + name.length),
				block.name,
				start + prevEnd,
				data,
				prevEnd > 0,
			);
			yield `: `;
		}
		else if (prevEnd < offset) {
			yield* generateNonIdentifierCode(
				code.slice(prevEnd, offset),
				block.name,
				start + prevEnd,
				data,
				prevEnd > 0,
			);
		}

		// Access strategy, in precedence order (keep in sync with the v-bind
		// shorthand handling in elementProps.ts):
		// - destructured props / imported components → direct reference
		// - template refs → direct `.value`
		// - dotValue bindings (narrowed at least once anywhere) → `.value` at
		//   every position; narrowing then works on the `.value` reference chain
		// - other bindings → `__VLS_unwrap` (plain reads keep the original type)
		// - otherwise → `__VLS_ctx.<name>`
		if (destructuredProps.has(name) || importedComponents.has(name)) {
			yield [
				name,
				block.name,
				start + offset,
				identifierData,
			];
		}
		else if (setupRefs.has(name)) {
			yield [
				name,
				block.name,
				start + offset,
				data,
			];
			yield `.value`;
		}
		else if (setupBindings.has(name)) {
			// First pass records narrowing accesses here; the second pass emits from dotValueBindings.
			ctx.accessVariable(block.name, name, start + offset, inTypeQuery || isNarrowing);
			if (inTypeQuery || dotValueBindings.has(name)) {
				yield [
					name,
					block.name,
					start + offset,
					identifierData,
				];
				yield `.value`;
			}
			else {
				// `new __VLS_unwrap(Foo)()` parses as `new (__VLS_unwrap(Foo)())`,
				// whose target lacks a construct signature; keep the operand parenthesized.
				if (isNewOperand) {
					yield `(`;
				}
				yield `${names.unwrap}(`;
				yield [
					name,
					block.name,
					start + offset,
					identifierData,
				];
				yield `, ${getRefBrandArgument(vueCompilerOptions)})`;
				if (isNewOperand) {
					yield `)`;
				}
			}
		}
		else {
			// #1205, #1264
			const boundary = yield* Boundary.start(
				block.name,
				start + offset,
				start + offset + name.length,
				codeFeatures.verification,
			);
			if (ctx.dollarVars.has(name)) {
				yield names.dollars;
			}
			else {
				ctx.accessVariable(block.name, name, start + offset);
				yield names.ctx;
			}
			yield `.`;
			yield [
				name,
				block.name,
				start + offset,
				identifierData,
			];
			yield boundary.end();
		}

		prevEnd = offset + name.length;
	}

	if (prevEnd < code.length) {
		yield* generateNonIdentifierCode(
			code.slice(prevEnd),
			block.name,
			start + prevEnd,
			data,
			prevEnd > 0,
		);
	}

	if (suffix) {
		yield suffix;
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
