import {
	completionFeatures,
	type IR,
	type IRScript,
	type IRScriptSetup,
	SpanMapFeature,
	structureFeatures,
} from '@vue/language-core';
import { embeddedCodeIds, type EmbeddedDocument } from './embeddedDocument';

/**
 * Each script block verbatim, for the TypeScript syntactic features of the block (structure, formatting, JSX closing
 * tags) and the define assignment suggestions, whichever content mapper serves the file to TypeScript.
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
