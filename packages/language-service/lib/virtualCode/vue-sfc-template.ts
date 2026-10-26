import { allFeatures, type Code, getPugTemplatePrefix, type IR } from '@vue/language-core';
import { embeddedCodeIds, type EmbeddedDocument } from './embeddedDocument';

/** The template block of an HTML or pug template. */
export function getTemplateDocument(ir: IR): EmbeddedDocument | undefined {
	if (ir.template?.lang !== 'html' && ir.template?.lang !== 'pug') {
		return;
	}
	const content: Code[] = [];
	if (ir.template.lang === 'pug') {
		const prefix = getPugTemplatePrefix(ir.template.content);
		if (prefix) {
			content.push(prefix);
		}
	}
	content.push([
		ir.template.content,
		ir.template.name,
		0,
		{ features: allFeatures },
	]);
	return { id: embeddedCodeIds.template, lang: ir.template.lang, content };
}
