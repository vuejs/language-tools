import type { Code, IRBlock, VueCodeInformation } from '../../types';
import { getNodeText, getStartEnd } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { getTypeScriptAST, identifierRE } from '../utils';
import { Boundary } from '../utils/boundary';
import { forEachDeclarations, shouldIdentifierSkipped } from './bindingReferences';
import type { TemplateCodegenContext } from './context';

export function* generateInterpolation(
	options: IdentifierOptions & { typescript: typeof import('typescript') },
	ctx: TemplateCodegenContext,
	block: IRBlock,
	features: VueCodeInformation,
	code: string,
	start: number,
	prefix = '',
	suffix = '',
): Generator<Code> {
	yield prefix;
	let prevEnd = 0;
	for (const [name, offset, isShorthand] of forEachIdentifiers(options.typescript, ctx, block, code, prefix, suffix)) {
		if (isShorthand) {
			yield* generateNonIdentifierCode(
				code.slice(prevEnd, offset),
				block.name,
				start + prevEnd,
				features,
				prevEnd > 0,
				true,
			);
			yield [name, block.name, start + offset, { verification: features.verification }];
			yield `: `;
		}
		else if (prevEnd < offset) {
			yield* generateNonIdentifierCode(
				code.slice(prevEnd, offset),
				block.name,
				start + prevEnd,
				features,
				prevEnd > 0,
				true,
			);
		}
		yield* generateIdentifier(
			options,
			ctx,
			[[name, block.name, start + offset, isShorthand ? { ...features, __shorthandExpression: 'js' } : features]],
			name,
			block.name,
			start + offset,
			start + offset + name.length,
		);
		prevEnd = offset + name.length;
	}
	if (prevEnd < code.length) {
		yield* generateNonIdentifierCode(code.slice(prevEnd), block.name, start + prevEnd, features, prevEnd > 0);
	}
	yield suffix;
}

// Adjacent mappings share their boundary offset. Keep punctuation from claiming
// the preceding identifier's navigation position.
function* generateNonIdentifierCode(
	code: string,
	source: string,
	offset: number,
	data: VueCodeInformation,
	shouldCut = true,
	shouldCutEnd = false,
): Generator<Code> {
	if (!code.length) {return;}
	if (shouldCutEnd) {
		yield* generateNonIdentifierCode(code.slice(0, -1), source, offset, data, shouldCut);
		yield [code.slice(-1), source, offset + code.length - 1, { verification: data.verification }];
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
	setupBindings: Set<string>;
	setupConsts: Set<string>;
}

export function* generateIdentifier(
	options: IdentifierOptions,
	ctx: TemplateCodegenContext,
	codes: Iterable<Code>,
	name: string,
	source: string,
	start: number,
	end: number,
): Generator<Code> {
	if (options.setupConsts.has(name) || shouldIdentifierSkipped(ctx, name)) {
		yield* codes;
	}
	else if (options.setupBindings.has(name)) {
		ctx.accessVariable(source, name);
		const features: VueCodeInformation = {};
		const references: Code[] = [];
		for (const code of codes) {
			if (typeof code === 'string') {
				references.push(code);
			}
			else {
				Object.assign(features, code[3], { navigation: false });
				references.push([code[0], code[1], code[2], {
					navigation: code[3].navigation,
					__shorthandExpression: code[3].__shorthandExpression,
				}]);
			}
		}
		ctx.bindingReferences.push(references);
		yield ['', source, start, { verification: features.verification }];
		yield `${names.templateBindings}.${name}.`;
		const boundary = yield* Boundary.start(source, start, end, features);
		yield 'value';
		yield boundary.end();
	}
	else {
		const boundary = yield* Boundary.start(source, start, end, codeFeatures.verification);
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
): Generator<[name: string, offset: number, isShorthand: boolean]> {
	if (identifierRE.test(code) && !shouldIdentifierSkipped(ctx, code)) {
		yield [code, 0, false];
		return;
	}
	const scope = ctx.scope();
	const ast = getTypeScriptAST(ts, block, prefix + code + suffix);
	for (const { id, isShorthand, skipped } of forEachDeclarations(ts, ast, ast, ctx, scope)) {
		if (!skipped) {
			yield [getNodeText(ts, id, ast), getStartEnd(ts, id, ast).start - prefix.length, isShorthand];
		}
	}
	scope.end();
}
