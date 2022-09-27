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
						range => sourceMap.getMappedRange(range.start, range.end)?.[0],
					),
					only: codeActionContext.only,
				};

				let minStart: number | undefined;
				let maxEnd: number | undefined;

				for (const mapping of sourceMap.base.mappings) {
					const overlapRange = shared.getOverlapRange2(offsetRange, mapping.sourceRange);
					if (overlapRange) {
						const embeddedRange = sourceMap.getMappedRange(overlapRange.start, overlapRange.end)?.[0];
						if (embeddedRange) {
							minStart = minStart === undefined ? embeddedRange.start : Math.min(embeddedRange.start, minStart);
							maxEnd = maxEnd === undefined ? embeddedRange.end : Math.max(embeddedRange.end, maxEnd);
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
