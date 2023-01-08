import * as transformer from '../transformer';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { PluginCompletionData } from './complete';

export function register(context: LanguageServiceRuntimeContext) {

	return async (item: vscode.CompletionItem) => {

		const data: PluginCompletionData | undefined = item.data;

		if (data) {

			const plugin = context.plugins[data.pluginId];

			if (!plugin)
				return item;

			if (!plugin.complete?.resolve)
				return item;

			const originalItem = data.originalItem;

			if (data.map) {

				for (const [_, map] of context.documents.getMapsByVirtualFileUri(data.map.embeddedDocumentUri)) {

					const resolvedItem = await plugin.complete.resolve(originalItem);

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

					item = transformer.asCompletionItem(
						resolvedItem,
						embeddedRange => {
							let range = plugin.resolveEmbeddedRange?.(embeddedRange);
							if (range) return range;
							return map.toSourceRange(embeddedRange);
						},
						map.virtualFileDocument,
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
