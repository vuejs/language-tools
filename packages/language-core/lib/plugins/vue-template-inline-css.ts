import * as CompilerDOM from '@vue/compiler-dom';
import { forEachElementNode } from '../codegen/template';
import type { Code, VueLanguagePlugin } from '../types';
import { allCodeFeatures } from './shared';

const codeFeatures = {
	...allCodeFeatures,
	format: false,
	structure: false,
};

const plugin: VueLanguagePlugin = () => {

	return {

		version: 2.1,

		getEmbeddedCodes(_fileName, sfc) {
			if (!sfc.template?.ast) {
				return [];
			}
			return [{ id: 'template_inline_css', lang: 'css' }];
		},

		resolveEmbeddedCode(_fileName, sfc, embeddedFile) {
			if (embeddedFile.id !== 'template_inline_css' || !sfc.template?.ast) {
				return;
			}
			embeddedFile.parentCodeId = 'template';
			embeddedFile.content.push(...generate(sfc.template.ast));
		},
	};
};

export default plugin;

function* generate(templateAst: NonNullable<CompilerDOM.RootNode>): Generator<Code> {
	for (const node of forEachElementNode(templateAst)) {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'bind'
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.content === 'style'
				&& prop.exp.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY
			) {
				const endCrt = prop.arg.loc.source[prop.arg.loc.source.length - 1]; // " | '
				const start = prop.arg.loc.source.indexOf(endCrt) + 1;
				const end = prop.arg.loc.source.lastIndexOf(endCrt);
				const content = prop.arg.loc.source.substring(start, end);

				yield `x { `;
				yield [
					content,
					'template',
					prop.arg.loc.start.offset + start,
					codeFeatures,
				];
				yield ` }\n`;
			}
		}
	}
}
