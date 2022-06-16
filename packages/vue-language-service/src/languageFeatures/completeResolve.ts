import { transformCompletionItem } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { PluginCompletionData } from './complete';

export function register(context: LanguageServiceRuntimeContext) {

	return async (item: vscode.CompletionItem, newPosition?: vscode.Position) => {

		const data: PluginCompletionData | undefined = item.data;

		if (data) {

			const plugin = context.getPluginById(data.pluginId);

			if (!plugin)
				return item;

			if (!plugin.complete?.resolve)
				return item;

			const originalItem = data.originalItem;

			if (data.sourceMap) {

				const sourceMap = context.vueDocuments.sourceMapFromEmbeddedDocumentUri(data.sourceMap.embeddedDocumentUri);

				if (sourceMap) {

					const newPosition_2 = newPosition
						? sourceMap.getMappedRange(newPosition, newPosition, data => !!data.capabilities.completion)?.[0].start
						: undefined;
					const resolvedItem = await plugin.complete.resolve(originalItem, newPosition_2);

					// fix https://github.com/johnsoncodehk/volar/issues/916
					if (resolvedItem.additionalTextEdits) {
						for (const edit of resolvedItem.additionalTextEdits) {
							if (
								edit.range.start.line === 0
								&& edit.range.start.character === 0
								&& edit.range.end.line === 0
								&& edit.range.end.character === 0
							) {
								edit.newText = '\n' + edit.newText;
							}
						}
					}

					item = transformCompletionItem(
						resolvedItem,
						embeddedRange => plugin.resolveEmbeddedRange?.(embeddedRange)
							?? sourceMap.getSourceRange(embeddedRange.start, embeddedRange.end)?.[0],
					);
				}
			}
			else {
				item = await plugin.complete.resolve(originalItem);
			}
		}

		// TODO: monkey fix import ts file icon
		if (item.detail !== item.detail + '.ts') {
			item.detail = item.detail;
		}

		return item;
	};
}
