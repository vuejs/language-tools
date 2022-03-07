import type { CodeAction } from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { PluginCodeActionData } from './codeActions';
import { tsEditToVueEdit } from '../services/rename';

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

			if (data.sourceMapId !== undefined && data.embeddedDocumentUri !== undefined) {

				const sourceMap = context.vueDocuments.getSourceMap(data.sourceMapId, data.embeddedDocumentUri);

				if (sourceMap) {

					const resolvedItem = await plugin.doCodeActionResolve(originalItem);

					if (resolvedItem.edit) {

						const edit = tsEditToVueEdit(sourceMap.lsType, false, resolvedItem.edit, context.vueDocuments, () => true);

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
