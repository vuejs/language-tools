import type { TsApiRegisterOptions } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ mapper }: TsApiRegisterOptions) {
	return (document: TextDocument, position: Position): string | undefined | null => {

		for (const tsRange of mapper.ts.to(document.uri, position)) {

			if (!tsRange.data.capabilities.completion)
				continue;

			const defs = tsRange.languageService.findDefinition(tsRange.textDocument.uri, tsRange.start);
			let isDef = false;
			for (const def of defs) {
				if (
					def.uri === tsRange.textDocument.uri
					&& def.range.end.line === tsRange.start.line
					&& def.range.end.character === tsRange.start.character
				) {
					isDef = true;
					break;
				}
			}

			if (isDef)
				continue;

			const typeDefs = tsRange.languageService.findTypeDefinition(tsRange.textDocument.uri, tsRange.start);
			for (const typeDefine of typeDefs) {
				const defineDoc = tsRange.languageService.getTextDocument(typeDefine.uri);
				if (!defineDoc)
					continue;
				const typeName = defineDoc.getText(typeDefine.range);
				if (typeDefine.uri.endsWith('reactivity.d.ts')) {
					switch (typeName) {
						case 'Ref':
						case 'ComputedRef':
						case 'WritableComputedRef':
							return '.value';
					}
				}
			}
		}
	}
}
