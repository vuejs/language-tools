import * as CompilerDOM from '@vue/compiler-dom';
import {
	type Code,
	forEachElementNode,
	type IR,
	type IRTemplate,
	normalizeAttributeValue,
	scriptFeatures,
} from '@vue/language-core';
import { embeddedCodeIds, type EmbeddedDocument } from './embeddedDocument';

/** The `style` attributes of the template elements, as CSS rules. */
export function getTemplateInlineCssDocument(ir: IR): EmbeddedDocument | undefined {
	if (!ir.template?.ast) {
		return;
	}
	return { id: embeddedCodeIds.templateInlineCss, lang: 'css', content: [...generate(ir.template, ir.template.ast)] };
}

function* generate(template: IRTemplate, templateAst: NonNullable<CompilerDOM.RootNode>): Generator<Code> {
	for (const node of forEachElementNode(templateAst)) {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
				&& prop.name === 'style'
				&& prop.value
			) {
				yield `x { `;
				const [content, offset] = normalizeAttributeValue(prop.value);
				yield {
					source: template,
					start: offset,
					end: offset + content.length,
					data: { features: scriptFeatures },
					text: content,
				};
				yield ` }\n`;
			}
		}
	}
}
