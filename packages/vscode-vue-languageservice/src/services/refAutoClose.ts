import type { TsApiRegisterOptions } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ mapper }: TsApiRegisterOptions) {
	return (document: TextDocument, position: Position): string | undefined | null => {

		for (const tsMaped of mapper.ts.to(document.uri, { start: position, end: position })) {

			if (!tsMaped.data.capabilities.completion)
				continue;

			const defs = tsMaped.languageService.findDefinition(tsMaped.textDocument.uri, tsMaped.range.start);
			let isDef = false;
			for (const def of defs) {
				if (
					def.uri === tsMaped.textDocument.uri
					&& def.range.end.line === tsMaped.range.start.line
					&& def.range.end.character === tsMaped.range.start.character
				) {
					isDef = true;
					break;
				}
			}

			if (isDef)
				continue;

			const typeDefs = tsMaped.languageService.findTypeDefinition(tsMaped.textDocument.uri, tsMaped.range.start);
			for (const typeDefine of typeDefs) {
				const defineDoc = tsMaped.languageService.getTextDocument(typeDefine.uri);
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
