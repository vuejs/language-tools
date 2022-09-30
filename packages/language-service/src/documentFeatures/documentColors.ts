import type { DocumentServiceRuntimeContext } from '../types';
import { documentFeatureWorker } from '../utils/featureWorkers';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';

export function register(context: DocumentServiceRuntimeContext) {

	return (document: TextDocument) => {

		return documentFeatureWorker(
			context,
			document,
			sourceMap => !!sourceMap.embeddedFile.capabilities.documentSymbol, // TODO: add color capabilitie setting
			(plugin, document) => plugin.findDocumentColors?.(document),
			(data, sourceMap) => data.map(color => {
				const range = sourceMap.toSourceRange(color.range);
				if (range) {
					return vscode.ColorInformation.create(range, color.color);
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		);
	};
}
