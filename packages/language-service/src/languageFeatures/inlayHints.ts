import * as shared from '@volar/shared';
import { transformTextEdit } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { getOverlapRange } from '../utils/common';
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
			(_arg, map, file) => {

				/**
				 * copy from ./codeActions.ts
				 */

				if (!file.capabilities.inlayHint)
					return [];

				let minStart: number | undefined;
				let maxEnd: number | undefined;

				for (const mapping of map.map.mappings) {
					const overlapRange = getOverlapRange(offsetRange.start, offsetRange.end, mapping.sourceRange[0], mapping.sourceRange[1]);
					if (overlapRange) {
						const start = map.map.toGeneratedOffset(overlapRange.start)?.[0];
						const end = map.map.toGeneratedOffset(overlapRange.end)?.[0];
						if (start !== undefined && end !== undefined) {
							minStart = minStart === undefined ? start : Math.min(start, minStart);
							maxEnd = maxEnd === undefined ? end : Math.max(end, maxEnd);
						}
					}
				}

				if (minStart !== undefined && maxEnd !== undefined) {
					return [vscode.Range.create(
						map.mappedDocument.positionAt(minStart),
						map.mappedDocument.positionAt(maxEnd),
					)];
				}

				return [];
			},
			(plugin, document, arg) => {
				return plugin.inlayHints?.on?.(document, arg);
			},
			(inlayHints, map) => inlayHints.map(_inlayHint => {

				if (!map)
					return _inlayHint;

				const position = map.toSourcePosition(_inlayHint.position);
				const edits = _inlayHint.textEdits
					?.map(textEdit => transformTextEdit(textEdit, range => map!.toSourceRange(range)))
					.filter(shared.notEmpty);

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
