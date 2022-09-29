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

				if (!sourceMap.embeddedFile.capabilities.inlayHint)
					return [];

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

				const position = sourceMap.toSourcePosition(_inlayHint.position)?.[0];
				const edits = _inlayHint.textEdits?.map(textEdit => transformTextEdit(textEdit, range => {
					const start = sourceMap.toSourcePosition(range.start)?.[0];
					const end = sourceMap.toSourcePosition(range.end)?.[0];
					if (start && end) {
						return { start, end };
					}
				})).filter(shared.notEmpty);

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
