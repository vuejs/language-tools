import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as transformer from '../transformer';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, positions: vscode.Position[]) => {

		return languageFeatureWorker(
			context,
			uri,
			positions,
			(positions, map, file) => {
				if (file.capabilities.documentFormatting) {
					const result = positions
						.map(position => map.toGeneratedPosition(position))
						.filter(shared.notEmpty);
					if (result.length) {
						return [result];
					}
				}
				return [];
			},
			(plugin, document, positions) => plugin.getSelectionRanges?.(document, positions),
			(item, map) => map ? transformer.asSelectionRanges(item, range => map.toSourceRange(range)) : item,
			results => {
				for (let i = 0; i < results[0].length; i++) {
					const first = results[0][i];
					let lastParent = first;
					while (lastParent.parent) {
						lastParent = lastParent.parent;
					}
					for (let j = 1; j < results.length; j++) {
						const other = results[j][i];
						lastParent.parent = other;
						while (lastParent.parent) {
							lastParent = lastParent.parent;
						}
					}
				}
				return results[0];
			},
		);
	};
}
