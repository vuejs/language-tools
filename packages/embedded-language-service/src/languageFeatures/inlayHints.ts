import * as shared from '@volar/shared';
import { transformTextEdit } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';

export function register(context: LanguageServiceRuntimeContext) {

	return async (uri: string, range: vscode.Range) => {

		const document = context.getTextDocument(uri);

		if (!document)
			return;

		const offsetRange = {
			start: document.offsetAt(range.start),
			end: document.offsetAt(range.end),
		};

		return languageFeatureWorker(
			context,
			uri,
			range,
			(arg, sourceMap) => {

				/**
				 * copy from ./codeActions.ts
				 */

				if (!sourceMap.embeddedFile.capabilities.inlayHints)
					return [];

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
					return [vscode.Range.create(
						sourceMap.mappedDocument.positionAt(minStart),
						sourceMap.mappedDocument.positionAt(maxEnd),
					)];
				}

				return [];
			},
			(plugin, document, arg, sourceMap) => {
				return plugin.inlayHints?.on?.(document, arg);
			},
			(inlayHints, sourceMap) => inlayHints.map(_inlayHint => {

				if (!sourceMap)
					return _inlayHint;

				const position = sourceMap.getSourceRange(_inlayHint.position, _inlayHint.position, data => !!data.capabilities.completion)?.[0].start;
				const edits = _inlayHint.textEdits?.map(textEdit => transformTextEdit(textEdit, range => sourceMap.getSourceRange(range.start, range.end)?.[0])).filter(shared.notEmpty);

				if (position) {
					return {
						..._inlayHint,
						position,
						edits,
					};
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		);
	};
}
