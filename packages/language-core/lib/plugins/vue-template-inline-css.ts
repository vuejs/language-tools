import * as CompilerDOM from '@vue/compiler-dom';
import type { Code, VueLanguagePlugin } from '../types';
import { forEachElementNode } from '../utils/forEachTemplateNode';
import { normalizeAttributeValue } from '../utils/shared';
import { allCodeFeatures } from './shared';

const codeFeatures = {
	...allCodeFeatures,
	format: false,
	structure: false,
};

const plugin: VueLanguagePlugin = () => {
	return {
		version: 2.2,

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
			embeddedFile.parentCodeId = sfc.template.lang === 'md' ? 'root_tags' : 'template';
			embeddedFile.content.push(...generate(sfc.template.ast));
		},
	};
};

export default plugin;

function* generate(templateAst: NonNullable<CompilerDOM.RootNode>): Generator<Code> {
	for (const node of forEachElementNode(templateAst)) {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
				&& prop.name === 'style'
				&& prop.value
			) {
				yield `x { `;
				const [content, offset] = normalizeAttributeValue(prop.value);
				yield [content, 'template', offset, codeFeatures];
				yield ` }\n`;
			}
		}
	}
}
