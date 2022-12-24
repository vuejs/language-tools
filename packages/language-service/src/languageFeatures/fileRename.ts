import type { LanguageServiceRuntimeContext } from '../types';
import { embeddedEditToSourceEdit } from './rename';
import type * as _ from 'vscode-languageserver-protocol';
import * as dedupe from '../utils/dedupe';
import { forEachEmbeddedFile } from '@volar/language-core';

export function register(context: LanguageServiceRuntimeContext) {

	return async (oldUri: string, newUri: string) => {

		const rootFile = context.documents.getRootFileBySourceFileUri(oldUri);

		if (rootFile) {

			let tsExt: string | undefined;

			forEachEmbeddedFile(rootFile, embedded => {
				if (embedded.kind && embedded.fileName.replace(rootFile.fileName, '').match(/^\.(js|ts)x?$/)) {
					tsExt = embedded.fileName.substring(embedded.fileName.lastIndexOf('.'));
				}
			});

			if (!tsExt) {
				return;
			}

			oldUri += tsExt;
			newUri += tsExt;
		}

		for (const plugin of context.plugins) {

			if (!plugin.doFileRename)
				continue;

			const workspaceEdit = await plugin.doFileRename(oldUri, newUri);

			if (workspaceEdit) {

				const result = embeddedEditToSourceEdit(
					workspaceEdit,
					context.documents,
				);

				if (result?.documentChanges) {
					result.documentChanges = dedupe.withDocumentChanges(result.documentChanges);
				}

				return result;
			}
		}
	};
}
