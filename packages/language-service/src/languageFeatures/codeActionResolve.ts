import type { CodeAction } from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { PluginCodeActionData } from './codeActions';
import { embeddedEditToSourceEdit } from './rename';

export function register(context: LanguageServiceRuntimeContext) {
	return async (item: CodeAction) => {

		const data: PluginCodeActionData = item.data;

		if (data) {

			const plugin = context.plugins[data.pluginId];

			if (!plugin)
				return item;

			if (!plugin.codeAction?.resolve)
				return item;

			const originalItem = data.originalItem;

			if (data.map) {

				if (context.documents.hasVirtualFileByUri(data.map.embeddedDocumentUri)) {

					const resolvedItem = await plugin.codeAction?.resolve(originalItem);

					if (resolvedItem.edit) {

						const edit = embeddedEditToSourceEdit(
							resolvedItem.edit,
							context.documents,
						);

						if (edit) {
							resolvedItem.edit = edit;
							return resolvedItem;
						}
					}
				}
			}
			else {
				return await plugin.codeAction?.resolve(originalItem);
			}
		}

		return item;
	};
}
