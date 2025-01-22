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
			else if (nameProp.type === CompilerDOM.NodeTypes.DIRECTIVE && nameProp.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
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
				node.loc.start.offset,
				node.loc.end.offset,
				ctx.codeFeatures.verification,
				`${options.slotsAssignName ?? '__VLS_slots'}['default']`
			);
		}
		yield `)?.(`;
		yield* wrapWith(
			startTagOffset,
			startTagOffset + node.tag.length,
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
		yield `var ${varSlot} = {${newLine}`;
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
			const isShortHand = nameProp.arg?.loc.start.offset === nameProp.exp.loc.start.offset;
			if (isShortHand) {
				ctx.inlayHints.push(createVBindShorthandInlayHintInfo(nameProp.exp.loc, 'name'));
			}
			const slotExpVar = ctx.getInternalVariable();
			yield `var ${slotExpVar} = `;
			yield* generateInterpolation(
				options,
				ctx,
				'template',
				ctx.codeFeatures.all,
				nameProp.exp.content,
				nameProp.exp.loc.start.offset,
				nameProp.exp,
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
	yield* generateElementChildren(options, ctx, node);
}
