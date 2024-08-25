import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { endOfLine, newLine, wrapWith } from '../common';
import type { TemplateCodegenContext } from './context';
import { generateElementChildren } from './elementChildren';
import { generateElementProps } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

export function* generateSlotOutlet(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.SlotOutletNode,
	currentComponent: CompilerDOM.ElementNode | undefined,
	componentCtxVar: string | undefined
): Generator<Code> {
	const startTagOffset = node.loc.start.offset + options.template.content.substring(node.loc.start.offset).indexOf(node.tag);
	const varSlot = ctx.getInternalVariable();
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
		yield `__VLS_normalizeSlot(`;
		yield* wrapWith(
			node.loc.start.offset,
			node.loc.end.offset,
			ctx.codeFeatures.verification,
			`${options.slotsAssignName ?? '__VLS_slots'}[`,
			...wrapWith(
				node.loc.start.offset,
				node.loc.end.offset,
				ctx.codeFeatures.verification,
				nameProp?.type === CompilerDOM.NodeTypes.ATTRIBUTE && nameProp.value
					? `'${nameProp.value.content}'`
					: nameProp?.type === CompilerDOM.NodeTypes.DIRECTIVE && nameProp.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
						? nameProp.exp.content
						: `('default' as const)`
			),
			`]`
		);
		yield `)?.(`;
		yield* wrapWith(
			startTagOffset,
			startTagOffset + node.tag.length,
			ctx.codeFeatures.verification,
			`{${newLine}`,
			...generateElementProps(options, ctx, node, node.props.filter(prop => prop !== nameProp), true),
			`}`
		);
		yield `)${endOfLine}`;
	}
	else {
		yield `var ${varSlot} = {${newLine}`;
		yield* generateElementProps(options, ctx, node, node.props.filter(prop => prop !== nameProp), true);
		yield `}${endOfLine}`;

		if (
			nameProp?.type === CompilerDOM.NodeTypes.ATTRIBUTE
			&& nameProp.value
		) {
			ctx.slots.push({
				name: nameProp.value.content,
				loc: nameProp.loc.start.offset + nameProp.loc.source.indexOf(nameProp.value.content, nameProp.name.length),
				tagRange: [startTagOffset, startTagOffset + node.tag.length],
				varName: varSlot,
				nodeLoc: node.loc,
			});
		}
		else if (
			nameProp?.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& nameProp.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		) {
			const slotExpVar = ctx.getInternalVariable();
			yield `var ${slotExpVar} = `;
			yield* generateInterpolation(
				options,
				ctx,
				nameProp.exp.content,
				nameProp.exp,
				nameProp.exp.loc.start.offset,
				ctx.codeFeatures.all,
				'(',
				')'
			);
			yield ` as const${endOfLine}`;
			ctx.dynamicSlots.push({
				expVar: slotExpVar,
				varName: varSlot,
			});
		}
		else {
			ctx.slots.push({
				name: 'default',
				tagRange: [startTagOffset, startTagOffset + node.tag.length],
				varName: varSlot,
				nodeLoc: node.loc,
			});
		}
	}
	yield* ctx.generateAutoImportCompletion();
	yield* generateElementChildren(options, ctx, node, currentComponent, componentCtxVar);
}
