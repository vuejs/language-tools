import * as shared from '@volar/shared';
import { transformLocations } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as dedupe from '../utils/dedupe';
import { languageFeatureWorker } from '../utils/featureWorkers';
import { embeddedEditToSourceEdit } from './rename';

export interface PluginCodeActionData {
	uri: string,
	originalItem: vscode.CodeAction,
	pluginId: number,
	sourceMap: {
		embeddedDocumentUri: string;
	} | undefined,
}

export function register(context: LanguageServiceRuntimeContext) {

	return async (uri: string, range: vscode.Range, codeActionContext: vscode.CodeActionContext) => {

		const document = context.getTextDocument(uri);

		if (!document)
			return;

		const offsetRange = {
			start: document.offsetAt(range.start),
			end: document.offsetAt(range.end),
		};

		let codeActions = await languageFeatureWorker(
			context,
			uri,
			{ range, codeActionContext },
			(arg, sourceMap) => {

				if (!sourceMap.embeddedFile.capabilities.codeAction)
					return [];

				const _codeActionContext: vscode.CodeActionContext = {
					diagnostics: transformLocations(
						codeActionContext.diagnostics,
						range => sourceMap.toGeneratedRange(range),
					),
					only: codeActionContext.only,
				};

				let minStart: number | undefined;
				let maxEnd: number | undefined;

				for (const mapping of sourceMap.mappings) {
					const overlapRange = shared.getOverlapRange2(offsetRange.start, offsetRange.end, mapping.sourceRange[0], mapping.sourceRange[1]);
					if (overlapRange) {
						const start = sourceMap.toGeneratedOffset(overlapRange.start)?.[0];
						const end = sourceMap.toGeneratedOffset(overlapRange.end)?.[0];
						if (start !== undefined && end !== undefined) {
							minStart = minStart === undefined ? start : Math.min(start, minStart);
							maxEnd = maxEnd === undefined ? end : Math.max(end, maxEnd);
						}
					}
				}

				if (minStart !== undefined && maxEnd !== undefined) {
					return [{
						range: vscode.Range.create(
							sourceMap.mappedDocument.positionAt(minStart),
							sourceMap.mappedDocument.positionAt(maxEnd),
						),
						codeActionContext: _codeActionContext,
					}];
				}

				return [];
			},
			async (plugin, document, arg, sourceMap) => {

				const codeActions = await plugin.codeAction?.on?.(document, arg.range, arg.codeActionContext);

				return codeActions?.map<vscode.CodeAction>(_codeAction => {
					return {
						..._codeAction,
						data: {
							uri,
							originalItem: _codeAction,
							pluginId: context.plugins.indexOf(plugin),
							sourceMap: sourceMap ? {
								embeddedDocumentUri: sourceMap.mappedDocument.uri,
							} : undefined,
						} satisfies PluginCodeActionData,
					};
				});
			},
			(_codeActions, sourceMap) => _codeActions.map(_codeAction => {

				if (!sourceMap)
					return _codeAction;

				if (_codeAction.edit) {
					const edit = embeddedEditToSourceEdit(
						_codeAction.edit,
						context.documents,
					);
					if (edit) {
						_codeAction.edit = edit;
						return _codeAction;
					}
				}
				else {
					return _codeAction;
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		);

		if (codeActions) {

			codeActions = codeActions.filter(codeAction => codeAction.title.indexOf('__VLS_') === -1);

			return dedupe.withCodeAction(codeActions);
		}
	};
}
