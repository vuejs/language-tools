import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import type { Code } from '../../types';
import { hyphenateAttr } from '../../utils/shared';
import { endOfLine, wrapWith } from '../common';
import { generateCamelized } from './camelized';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

export function* generateElementDirectives(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode
): Generator<Code> {
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name !== 'slot'
			&& prop.name !== 'on'
			&& prop.name !== 'model'
			&& prop.name !== 'bind'
			&& prop.name !== 'scope'
			&& prop.name !== 'data'
		) {
			ctx.accessExternalVariable(camelize('v-' + prop.name), prop.loc.start.offset);

			if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && !prop.arg.isStatic) {
				yield* generateInterpolation(
					options,
					ctx,
					prop.arg.content,
					prop.arg.loc,
					prop.arg.loc.start.offset + prop.arg.loc.source.indexOf(prop.arg.content),
					ctx.codeFeatures.all,
					'(',
					')'
				);
				yield endOfLine;
			}

			yield* wrapWith(
				prop.loc.start.offset,
				prop.loc.end.offset,
				ctx.codeFeatures.verification,
				`__VLS_directiveAsFunction(__VLS_directives.`,
				...generateCamelized(
					'v-' + prop.name,
					prop.loc.start.offset,
					{
						...ctx.codeFeatures.all,
						verification: false,
						completion: {
							// fix https://github.com/vuejs/language-tools/issues/1905
							isAdditional: true,
						},
						navigation: {
							resolveRenameNewName: camelize,
							resolveRenameEditText: getPropRenameApply(prop.name),
						},
					}
				),
				`)(null!, { ...__VLS_directiveBindingRestFields, `,
				...(
					prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
						? [
							...wrapWith(
								prop.exp.loc.start.offset,
								prop.exp.loc.end.offset,
								ctx.codeFeatures.verification,
								'value'
							),
							': ',
							...wrapWith(
								prop.exp.loc.start.offset,
								prop.exp.loc.end.offset,
								ctx.codeFeatures.verification,
								...generateInterpolation(
									options,
									ctx,
									prop.exp.content,
									prop.exp.loc,
									prop.exp.loc.start.offset,
									ctx.codeFeatures.all,
									'(',
									')'
								)
							)
						]
						: [`undefined`]
				),
				`}, null!, null!)`
			);
			yield endOfLine;
		}
	}
}

function getPropRenameApply(oldName: string) {
	return oldName === hyphenateAttr(oldName) ? hyphenateAttr : undefined;
}
