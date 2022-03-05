import { TextDocument } from 'vscode-languageserver-textdocument';
import type { EmbeddedDocumentSourceMap } from '@volar/vue-typescript';
import * as vscode from 'vscode-languageserver-protocol';
import type { DocumentServiceRuntimeContext } from '../types';
import { visitEmbedded } from '../plugins/definePlugin';

export function register(context: DocumentServiceRuntimeContext) {

	return async (document: TextDocument) => {

		const vueDocument = context.getVueDocument(document);
		const rangesList: vscode.FoldingRange[][] = [];

		if (vueDocument) {

			const embeddeds = vueDocument.getEmbeddeds();

			await visitEmbedded(embeddeds, async sourceMap => {

				if (!sourceMap.capabilities.foldingRanges)
					return true;

				const plugins = context.getPlugins(sourceMap.mappedDocument);

				for (const plugin of plugins) {

					if (!plugin.getFoldingRanges)
						continue;

					const embeddedRanges = await plugin.getFoldingRanges(sourceMap.mappedDocument);

					if (!embeddedRanges)
						continue;

					const ranges = toVueFoldingRangesTs(embeddedRanges, sourceMap);

					rangesList.push(ranges);
				}

				return true;
			});
		}

		const plugins = context.getPlugins(document);

		for (const plugin of plugins) {

			if (!plugin.getFoldingRanges)
				continue;

			const foldingRange = await plugin.getFoldingRanges(document);

			if (!foldingRange)
				continue;

			rangesList.push(foldingRange);
		}

		return rangesList.flat();
	}
}

function toVueFoldingRangesTs(virtualFoldingRanges: vscode.FoldingRange[], sourceMap: EmbeddedDocumentSourceMap) {
	const result: vscode.FoldingRange[] = [];
	for (const foldingRange of virtualFoldingRanges) {
		const vueLoc = sourceMap.getSourceRange(
			{ line: foldingRange.startLine, character: foldingRange.startCharacter ?? 0 },
			{ line: foldingRange.endLine, character: foldingRange.endCharacter ?? 0 },
			data => !!data.capabilities.foldingRanges,
		)?.[0];
		if (vueLoc) {
			foldingRange.startLine = vueLoc.start.line;
			foldingRange.endLine = vueLoc.end.line;
			if (foldingRange.startCharacter !== undefined)
				foldingRange.startCharacter = vueLoc.start.character;
			if (foldingRange.endCharacter !== undefined)
				foldingRange.endCharacter = vueLoc.end.character;
			result.push(foldingRange);
		}
	}
	return result;
}
