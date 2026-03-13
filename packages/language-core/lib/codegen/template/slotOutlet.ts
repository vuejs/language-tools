import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { getElementTagOffsets, normalizeAttributeValue } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { createVBindShorthandInlayHintInfo } from '../inlayHints';
import { names } from '../names';
import { endOfLine, newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import type { TemplateCodegenContext } from './context';
import { generateElementProps, generatePropExp } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generatePropertyAccess } from './propertyAccess';
import { generateTemplateChild } from './templateChild';

export function* generateSlotOutlet(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.SlotOutletNode,
): Generator<Code> {
	const [startTagOffset] = getElementTagOffsets(node, options.template);
	const startTagEndOffset = startTagOffset + node.tag.length;
	const propsVar = ctx.getInternalVariable();
	const nameProp = node.props.find(prop => {
		if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE) {
			return prop.name === 'name';
		}
		if (
			prop.name === 'bind'
			&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		) {
			return prop.arg.content === 'name';
		}
	});

	if (options.hasDefineSlots) {
		yield `${names.asFunctionalSlot}(`;
		if (nameProp) {
			let codes: Generator<Code> | Code[];
			if (nameProp.type === CompilerDOM.NodeTypes.ATTRIBUTE && nameProp.value) {
				const [content, offset] = normalizeAttributeValue(nameProp.value);
				codes = generatePropertyAccess(options, ctx, content, offset, codeFeatures.navigationAndVerification);
			}
			else if (
				nameProp.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& nameProp.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				codes = [
					`[`,
					...generatePropExp(
						options,
						ctx,
						nameProp,
						nameProp.exp,
					),
					`]`,
				];
			}
			else {
				codes = [`['default']`];
			}

			const token = yield* startBoundary('template', nameProp.loc.start.offset, codeFeatures.verification);
			yield options.slotsAssignName ?? names.slots;
			yield* codes;
			yield endBoundary(token, nameProp.loc.end.offset);
		}
		else {
			const token = yield* startBoundary('template', startTagOffset, codeFeatures.verification);
			yield `${options.slotsAssignName ?? names.slots}[`;
			const token2 = yield* startBoundary('template', startTagOffset, codeFeatures.verification);
			yield `'default'`;
			yield endBoundary(token2, startTagEndOffset);
			yield `]`;
			yield endBoundary(token, startTagEndOffset);
		}
		yield `)(`;
		const token = yield* startBoundary('template', startTagOffset, codeFeatures.verification);
		yield `{${newLine}`;
		yield* generateElementProps(
			options,
			ctx,
			node,
			node.props.filter(prop => prop !== nameProp),
			true,
		);
		yield `}`;
		yield endBoundary(token, startTagEndOffset);
		yield `)${endOfLine}`;
	}
	else {
		yield `var ${propsVar} = {${newLine}`;
		yield* generateElementProps(
			options,
			ctx,
			node,
			node.props.filter(prop => prop !== nameProp),
			options.vueCompilerOptions.checkUnknownProps,
		);
		yield `}${endOfLine}`;

		if (
			nameProp?.type === CompilerDOM.NodeTypes.ATTRIBUTE
			&& nameProp.value
		) {
			ctx.slots.push({
				name: nameProp.value.content,
				offset: nameProp.loc.start.offset + nameProp.loc.source.indexOf(nameProp.value.content, nameProp.name.length),
				tagRange: [startTagOffset, startTagOffset + node.tag.length],
				nodeLoc: node.loc,
				propsVar: ctx.getHoistVariable(propsVar),
			});
		}
		else if (
			nameProp?.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& nameProp.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		) {
			const isShortHand = nameProp.arg?.loc.start.offset === nameProp.exp.loc.start.offset;
			if (isShortHand) {
				ctx.inlayHints.push(createVBindShorthandInlayHintInfo(nameProp.exp.loc, 'name'));
			}
			const expVar = ctx.getInternalVariable();
			yield `var ${expVar} = ${names.tryAsConstant}(`;
			yield* generateInterpolation(
				options,
				ctx,
				options.template,
				isShortHand
					? codeFeatures.withoutHighlightAndCompletion
					: codeFeatures.all,
				nameProp.exp.content,
				nameProp.exp.loc.start.offset,
			);
			yield `)${endOfLine}`;
			ctx.dynamicSlots.push({
				expVar: ctx.getHoistVariable(expVar),
				propsVar: ctx.getHoistVariable(propsVar),
			});
		}
		else {
			ctx.slots.push({
				name: 'default',
				tagRange: [startTagOffset, startTagEndOffset],
				nodeLoc: node.loc,
				propsVar: ctx.getHoistVariable(propsVar),
			});
		}
	}
	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child);
	}
}
