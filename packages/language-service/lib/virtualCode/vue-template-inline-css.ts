import * as CompilerDOM from '@vue/compiler-dom';
import { type Code, forEachElementNode, type IR, normalizeAttributeValue, scriptFeatures } from '@vue/language-core';
import { embeddedCodeIds, type EmbeddedDocument } from './embeddedDocument';

/** The `style` attributes of the template elements, as CSS rules. */
export function getTemplateInlineCssDocument(ir: IR): EmbeddedDocument | undefined {
	if (!ir.template?.ast) {
		return;
	}
	return { id: embeddedCodeIds.templateInlineCss, lang: 'css', content: [...generate(ir.template.ast)] };
}

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
				yield [content, 'template', offset, { features: scriptFeatures }];
				yield ` }\n`;
			}
		}
	}
}
