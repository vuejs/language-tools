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

				if (!sourceMap)
					return color;

				const start = sourceMap.toSourcePosition(color.range.start)?.[0];
				const end = sourceMap.toSourcePosition(color.range.start)?.[0];

				if (start && end) {
					return vscode.ColorInformation.create({ start, end }, color.color);
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		);
	};
}
