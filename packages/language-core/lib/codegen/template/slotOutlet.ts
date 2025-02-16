import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { createVBindShorthandInlayHintInfo } from '../inlayHints';
import { endOfLine, newLine, wrapWith } from '../utils';
import type { TemplateCodegenContext } from './context';
import { generateElementChildren } from './elementChildren';
import { generateElementProps, generatePropExp } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generatePropertyAccess } from './propertyAccess';

export function* generateSlotOutlet(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.SlotOutletNode
): Generator<Code> {
	const startTagOffset = node.loc.start.offset + options.template.content.slice(node.loc.start.offset).indexOf(node.tag);
	const startTagEndOffset = startTagOffset + node.tag.length;
	const propsVar = ctx.getInternalVariable();
	const nameProp = node.props.find(prop => {
		if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE) {
			return prop.name === 'name';
		}
		if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'bind'
			&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		) {
			return prop.arg.content === 'name';
		}
	});

	if (options.hasDefineSlots) {
		yield `__VLS_asFunctionalSlot(`;
		if (nameProp) {
			let codes: Generator<Code> | Code[];
			if (nameProp.type === CompilerDOM.NodeTypes.ATTRIBUTE && nameProp.value) {
				let { source, start: { offset } } = nameProp.value.loc;
				if (source.startsWith('"') || source.startsWith("'")) {
					source = source.slice(1, -1);
					offset++;
				}
				codes = generatePropertyAccess(
					options,
					ctx,
					source,
					offset,
					ctx.codeFeatures.navigationAndVerification
				);
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
						ctx.codeFeatures.all,
						true
					),
					`]`
				];
			}
			else {
				codes = [`['default']`];
			}

			yield* wrapWith(
				nameProp.loc.start.offset,
				nameProp.loc.end.offset,
				ctx.codeFeatures.verification,
				`${options.slotsAssignName ?? '__VLS_slots'}`,
				...codes
			);
		}
		else {
			yield* wrapWith(
				startTagOffset,
				startTagEndOffset,
				ctx.codeFeatures.verification,
				`${options.slotsAssignName ?? '__VLS_slots'}[`,
				...wrapWith(
					startTagOffset,
					startTagEndOffset,
					ctx.codeFeatures.verification,
					`'default'`
				),
				`]`
			);
		}
		yield `)(`;
		yield* wrapWith(
			startTagOffset,
			startTagEndOffset,
			ctx.codeFeatures.verification,
			`{${newLine}`,
			...generateElementProps(
				options,
				ctx,
				node,
				node.props.filter(prop => prop !== nameProp),
				true,
				true
			),
			`}`
		);
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
			true
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
				propsVar,
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
			yield `var ${expVar} = __VLS_tryAsConstant(`;
			yield* generateInterpolation(
				options,
				ctx,
				'template',
				ctx.codeFeatures.all,
				nameProp.exp.content,
				nameProp.exp.loc.start.offset,
				nameProp.exp
			);
			yield `)${endOfLine}`;
			ctx.dynamicSlots.push({
				expVar,
				propsVar,
			});
		}
		else {
			ctx.slots.push({
				name: 'default',
				tagRange: [startTagOffset, startTagEndOffset],
				nodeLoc: node.loc,
				propsVar,
			});
		}
	}
	yield* ctx.generateAutoImportCompletion();
	yield* generateElementChildren(options, ctx, node);
}
