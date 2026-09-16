import { toString } from 'muggle-string';
import type { MatchPattern, PatternBinding } from '../../template/patterns/parser';
import type { TemplateMatch, TemplateMatchArm } from '../../template/patterns/prepare';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { endBoundary, startBoundary } from '../utils/boundary';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateTemplateChild } from './templateChild';

export function* generateVMatch(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	match: TemplateMatch,
): Generator<Code> {
	ctx.generatedTypes.add(names.MatchPattern);
	const valueDeclarations: [string, Code[]][] = [];
	const { subject, arms } = match;
	const subjectCodes = [
		...generateInterpolation(
			options,
			ctx,
			options.template,
			codeFeatures.all,
			subject.content,
			subject.loc.start.offset,
		),
	];
	const subjectText = toString(subjectCodes);
	const local = ctx.getInternalVariable();
	const endMatchScope = ctx.startScope();
	yield `{\nconst ${local} = (`;
	yield* subjectCodes;
	yield `);\n`;
	let remaining = `typeof ${local}`;
	for (const arm of arms) {
		const patternType = ctx.getInternalVariable();
		const descriptors = [...generateDescriptor(arm.pattern, arm)];
		for (const [name, codes] of valueDeclarations.splice(0)) {
			yield `const ${name} = (`;
			yield* codes;
			yield ');\n';
		}
		yield `type ${patternType} = `;
		yield* descriptors;
		yield `;\n`;
		const narrowed = ctx.getInternalVariable();
		yield `type ${narrowed} = ${names.MatchPattern}<${remaining}, ${patternType}>;\n`;
		// Marker is inspected by the language service for warning-only unreachable arms.
		yield `type __VLS_match_arm_${arm.offset}_${arm.directive.exp!.loc.end.offset} = ${narrowed};\n`;
		const endArmScope = ctx.startScope();
		const localValue = ctx.getInternalVariable();
		const condition = `((value: typeof ${local}): value is typeof ${local} & ${narrowed} => true)(${local})`;
		// Retain the source expression as a second narrowing target so result.data
		// and enclosing v-for/slot aliases receive the same refinement as bindings.
		const sourceCondition =
			`((value: typeof ${local}): value is typeof ${local} & ${narrowed} => true)(${subjectText})`;
		yield `if (${condition} && ${sourceCondition}) {\nconst ${localValue} = ${local} as ${narrowed};\n`;
		const conditionLength = ctx.blockConditions.length;
		ctx.blockConditions.push(condition, sourceCondition);
		for (const binding of arm.bindings) {
			ctx.declare(binding.name);
		}
		yield* generateBindings(arm.pattern, localValue, arm);
		if (arm.guard) {
			const codes = [
				...generateInterpolation(
					options,
					ctx,
					options.template,
					codeFeatures.all,
					arm.guard.text,
					arm.offset + arm.guard.start,
					'(',
					')',
				),
			];
			yield 'if ';
			yield* codes;
			yield ' {\n';
			ctx.blockConditions.push(toString(codes));
		}
		yield* generateTemplateChild(options, ctx, arm.node, true, true);
		if (arm.guard) {
			yield '}\n';
		}
		yield* endArmScope();
		yield '}\n';
		ctx.blockConditions.length = conditionLength;
		if (!arm.guard) {
			const next = ctx.getInternalVariable();
			yield `type ${next} = ${names.SubtractPattern}<${remaining}, ${patternType}>;\n`;
			remaining = next;
		}
	}
	const check = ctx.getInternalVariable();
	yield 'const ';
	const token = yield* startBoundary('template', subject.loc.start.offset, codeFeatures.verification);
	yield check;
	yield endBoundary(token, subject.loc.end.offset);
	yield `: ${names.CheckMatchExhaustive}<${remaining}> = true`;
	yield ';\n';
	yield* endMatchScope();
	yield '}\n';

	function* generateDescriptor(pattern: MatchPattern, arm: TemplateMatchArm): Generator<Code> {
		switch (pattern.kind) {
			case 'wildcard':
			case 'binding':
				yield "['any']";
				break;
			case 'as':
				yield* generateDescriptor(pattern.pattern, arm);
				break;
			case 'literal':
				yield `['literal', ${pattern.text.replace(/^\+/, '')}]`;
				break;
			case 'value': {
				// A value may have a union type. Coverage accepts it only when that
				// type is a statically known singleton; narrowing uses its full type.
				const value = ctx.getInternalVariable();
				// Descriptors are generated before their type declaration is emitted.
				// Store the expression in a typeof-compatible const outside that type.
				const codes = [
					...generateInterpolation(
						options,
						ctx,
						options.template,
						codeFeatures.all,
						pattern.text,
						arm.offset + pattern.start,
					),
				];
				valueDeclarations.push([value, codes]);
				yield `['value', typeof ${value}]`;
				break;
			}
			case 'or':
				yield "['or', [";
				for (const p of pattern.patterns) {
					yield* generateDescriptor(p, arm);
					yield ',';
				}
				yield ']]';
				break;
			case 'object':
				yield "['object', [";
				for (const property of pattern.properties) {
					yield `[${JSON.stringify(property.key)}, `;
					yield* generateDescriptor(property.pattern, arm);
					yield '],';
				}
				yield ']]';
				break;
			case 'array':
				yield "['array', [";
				for (const p of pattern.elements) {
					yield* generateDescriptor(p, arm);
					yield ',';
				}
				yield `], ${!!pattern.rest}]`;
		}
	}
	function* declare(binding: PatternBinding, value: string, arm: TemplateMatchArm): Generator<Code> {
		yield 'const ';
		yield [binding.name, 'template', arm.offset + binding.start, codeFeatures.all];
		yield ` = ${value};\n`;
	}
	function* generateBindings(pattern: MatchPattern, value: string, arm: TemplateMatchArm): Generator<Code> {
		switch (pattern.kind) {
			case 'binding':
				yield* declare(pattern, value, arm);
				break;
			case 'as':
				yield* generateBindings(pattern.pattern, value, arm);
				yield* declare(pattern.binding, value, arm);
				break;
			case 'object':
				for (const property of pattern.properties) {
					yield* generateBindings(property.pattern, `${value}[${JSON.stringify(property.key)}]`, arm);
				}
				if (pattern.rest?.binding) {
					yield 'const { ';
					for (const property of pattern.properties) {
						yield `[${JSON.stringify(property.key)}]: ${ctx.getInternalVariable()}, `;
					}
					yield '...';
					yield [pattern.rest.binding.name, 'template', arm.offset + pattern.rest.binding.start, codeFeatures.all];
					yield ` } = ${value};\n`;
				}
				break;
			case 'array':
				for (let i = 0; i < pattern.elements.length; i++) {
					yield* generateBindings(pattern.elements[i]!, `${value}[${i}]`, arm);
				}
				if (pattern.rest?.binding) {
					yield `const [${','.repeat(pattern.elements.length)}...`;
					yield [pattern.rest.binding.name, 'template', arm.offset + pattern.rest.binding.start, codeFeatures.all];
					yield `] = ${value};\n`;
				}
				break;
		}
	}
}
