import type { TsApiRegisterOptions } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { ResponseError } from 'vscode-languageserver/node';

export function register({ mapper }: TsApiRegisterOptions) {

	return (document: TextDocument, position: Position) => {
		const tsResult = onTs(document.uri, position);
		return tsResult;
	}

	function onTs(uri: string, position: Position) {
		for (const tsMaped of mapper.ts.to(uri, { start: position, end: position })) {
			if (
				tsMaped.data.capabilities.rename === true
				|| (typeof tsMaped.data.capabilities.rename === 'object' && tsMaped.data.capabilities.rename.in)
			) {
				const tsRange = tsMaped.languageService.prepareRename(
					tsMaped.textDocument.uri,
					tsMaped.range.start,
				);
				if (!tsRange)
					continue;

				if (tsRange instanceof ResponseError)
					return tsRange;

				for (const vueMaped of mapper.ts.from(tsMaped.textDocument.uri, tsRange))
					return vueMaped.range;
			}
		}
	}
}
