import * as CompilerDOM from '@vue/compiler-dom';
import { codeFeatures } from '../codegen/codeFeatures';
import type { Code, VueLanguagePlugin } from '../types';
import { forEachElementNode } from '../utils/forEachTemplateNode';
import { normalizeAttributeValue } from '../utils/shared';

const plugin: VueLanguagePlugin = () => {
	return {
		version: 2.2,

		getEmbeddedCodes(_fileName, ir) {
			if (!ir.template?.ast) {
				return [];
			}
			return [{ id: 'template_inline_css', lang: 'css' }];
		},

		resolveEmbeddedCode(_fileName, ir, embeddedFile) {
			if (embeddedFile.id !== 'template_inline_css' || !ir.template?.ast) {
				return;
			}
			embeddedFile.parentCodeId = ir.template.lang === 'md' ? 'root_tags' : 'template';
			embeddedFile.content.push(...generate(ir.template.ast));
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
				yield [content, 'template', offset, codeFeatures.all];
				yield ` }\n`;
			}
		}
	}
}
