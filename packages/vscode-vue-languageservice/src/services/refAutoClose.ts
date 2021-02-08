import type { TsApiRegisterOptions } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ mapper }: TsApiRegisterOptions) {
	return (document: TextDocument, position: Position): string | undefined | null => {

		for (const tsMaped of mapper.ts.to(document.uri, { start: position, end: position })) {

			if (!tsMaped.data.capabilities.completion)
				continue;

			const typeDefines = tsMaped.languageService.findTypeDefinition(tsMaped.textDocument.uri, tsMaped.range.start);
			for (const typeDefine of typeDefines) {
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
