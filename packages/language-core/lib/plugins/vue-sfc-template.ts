import { allFeatures } from '../features';
import type { Code, IR } from '../types';
import { embeddedCodeIds, type EmbeddedDocument } from '../virtualCode/embeddedDocument';

/** The template block of an HTML or pug template. */
export function getTemplateDocument(ir: IR): EmbeddedDocument | undefined {
	if (ir.template?.lang !== 'html' && ir.template?.lang !== 'pug') {
		return;
	}
	const content: Code[] = [];
	// Pug reads an indented first line as an error, so an indented template is parsed as the children of a tag
	if (ir.template.lang === 'pug' && calculateMinIndent(ir.template.content) !== 0) {
		content.push(`template\n`);
	}
	content.push([
		ir.template.content,
		ir.template.name,
		0,
		{ features: allFeatures },
	]);
	return { id: embeddedCodeIds.template, lang: ir.template.lang, content };
}

function calculateMinIndent(s: string) {
	const lines = s.split('\n');
	const minIndent = lines.reduce(function(minIndent, line) {
		if (line.trim() === '') {
			return minIndent;
		}
		const indent = line.match(/^\s*/)?.[0]?.length || 0;
		return Math.min(indent, minIndent);
	}, Infinity);
	return minIndent;
}
