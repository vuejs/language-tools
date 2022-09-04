import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver-protocol';
import { SemanticToken } from '@volar/vue-language-service-types';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, range?: vscode.Range, cancleToken?: vscode.CancellationToken, reportProgress?: (tokens: SemanticToken[]) => void) => {

		const document = context.getTextDocument(uri);

		if (!document)
			return;

		const offsetRange = range ? {
			start: document.offsetAt(range.start),
			end: document.offsetAt(range.end),
		} : {
			start: 0,
			end: document.getText().length,
		};

		return languageFeatureWorker(
			context,
			uri,
			offsetRange,
			function* (offsetRange, sourceMap) {

				if (cancleToken?.isCancellationRequested)
					return;

				let range: {
					start: number,
					end: number,
				} | undefined;

				for (const mapping of sourceMap.base.mappings) {

					if (cancleToken?.isCancellationRequested)
						return;

					if (
						mapping.data.capabilities.semanticTokens
						&& mapping.sourceRange.end > offsetRange.start
						&& mapping.sourceRange.start < offsetRange.end
					) {
						if (!range) {
							range = { ...mapping.mappedRange };
						}
						else {
							range.start = Math.min(range.start, mapping.mappedRange.start);
							range.end = Math.max(range.end, mapping.mappedRange.end);
						}
					}
				}

				if (range) {
					yield range;
				}
			},
			(plugin, document, offsetRange) => plugin.findDocumentSemanticTokens?.(
				document,
				vscode.Range.create(document.positionAt(offsetRange.start), document.positionAt(offsetRange.end)),
				cancleToken,
			),
			(tokens, sourceMap) => tokens.map(_token => {

				if (!sourceMap)
					return _token;

				const _start = sourceMap.mappedDocument.offsetAt({ line: _token[0], character: _token[1] });
				const _end = sourceMap.mappedDocument.offsetAt({ line: _token[0], character: _token[1] + _token[2] });
				const range = sourceMap.getSourceRange(_start, _end, data => !!data.capabilities.semanticTokens)?.[0];

				if (!range)
					return;

				const start = document.positionAt(range.start);
				const token: SemanticToken = [start.line, start.character, range.end - range.start, _token[3], _token[4]];

				return token;
			}).filter(shared.notEmpty),
			tokens => tokens.flat(),
			reportProgress, // TODO: this has no effect in LSP
		);
	};
}
