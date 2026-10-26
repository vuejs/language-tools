import { SpanMapFeature } from '@volar/language-core';
import { completionFeatures, structureFeatures } from '../features';
import type { IR, IRScript, IRScriptSetup } from '../types';
import { embeddedCodeIds, type EmbeddedDocument } from '../virtualCode/embeddedDocument';

/**
 * Each script block verbatim, for the TypeScript syntactic features of the block (structure, formatting, JSDoc
 * comment templates, JSX closing tags), whichever content mapper serves the file to TypeScript.
 */
export function getScriptDocuments(ir: IR): EmbeddedDocument[] {
	const result: EmbeddedDocument[] = [];
	if (ir.script) {
		result.push(getScriptDocument(embeddedCodeIds.scriptRaw, ir.script));
	}
	if (ir.scriptSetup) {
		result.push(getScriptDocument(embeddedCodeIds.scriptSetupRaw, ir.scriptSetup));
	}
	return result;
}

function getScriptDocument(id: string, script: IRScript | IRScriptSetup): EmbeddedDocument {
	return {
		id,
		lang: script.lang,
		content: [[
			script.content,
			script.name,
			0,
			{ features: structureFeatures | SpanMapFeature.Formatting | completionFeatures },
		]],
	};
}
