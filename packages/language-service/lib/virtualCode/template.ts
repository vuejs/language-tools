import { allFeatures, type IR } from '@vue/language-core';
import { embeddedCodeIds, type EmbeddedDocument } from './embeddedDocument';

/** The template block of an HTML or pug template. */
export function getTemplateDocument(ir: IR): EmbeddedDocument | undefined {
	if (ir.template?.lang !== 'html' && ir.template?.lang !== 'pug') {
		return;
	}
	return {
		id: embeddedCodeIds.template,
		lang: ir.template.lang,
		content: [[ir.template.content, ir.template, 0, { features: allFeatures }]],
	};
}
