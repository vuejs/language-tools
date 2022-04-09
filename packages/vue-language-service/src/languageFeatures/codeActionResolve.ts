import type { CodeAction } from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { PluginCodeActionData } from './codeActions';
import { embeddedEditToSourceEdit } from './rename';

export function register(context: LanguageServiceRuntimeContext) {
	return async (item: CodeAction) => {

		const data: PluginCodeActionData = item.data as any;

		if (data) {

			const plugin = context.getPluginById(data.pluginId);

			if (!plugin)
				return item;

			if (!plugin.doCodeActionResolve)
				return item;

			const originalItem = data.originalItem;

			if (data.sourceMap) {

				const sourceMap = context.vueDocuments.sourceMapFromEmbeddedDocumentUri(data.sourceMap.embeddedDocumentUri);

				if (sourceMap) {

					const resolvedItem = await plugin.doCodeActionResolve(originalItem);

					if (resolvedItem.edit) {

						const edit = embeddedEditToSourceEdit(
							resolvedItem.edit,
							context.vueDocuments,
						);

						if (edit) {
							resolvedItem.edit = edit;
							return resolvedItem;
						}
					}
				}
			}
			else {
				item = await plugin.doCodeActionResolve(item);
			}
		}

		return item;
	}
}
