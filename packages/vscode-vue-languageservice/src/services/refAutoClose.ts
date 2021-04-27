import type { TsApiRegisterOptions } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { Location } from 'vscode-languageserver/node';

export function register({ mapper }: TsApiRegisterOptions) {
	return (document: TextDocument, position: Position): string | undefined | null => {

		for (const tsRange of mapper.ts.to(document.uri, position)) {

			if (!tsRange.data.capabilities.completion)
				continue;

			const defs = tsRange.languageService.findDefinition(tsRange.textDocument.uri, tsRange.range.start);
			let isDef = false;
			for (const def of defs) {
				const uri = Location.is(def) ? def.uri : def.targetUri;
				const range = Location.is(def) ? def.range : def.targetSelectionRange;
				if (
					uri === tsRange.textDocument.uri
					&& range.end.line === tsRange.range.start.line
					&& range.end.character === tsRange.range.start.character
				) {
					isDef = true;
					break;
				}
			}

			if (isDef)
				continue;

			const typeDefs = tsRange.languageService.findTypeDefinition(tsRange.textDocument.uri, tsRange.range.start);
			for (const typeDefine of typeDefs) {
				const uri = Location.is(typeDefine) ? typeDefine.uri : typeDefine.targetUri;
				const range = Location.is(typeDefine) ? typeDefine.range : typeDefine.targetSelectionRange;
				const defineDoc = tsRange.languageService.getTextDocument(uri);
				if (!defineDoc)
					continue;
				const typeName = defineDoc.getText(range);
				if (uri.endsWith('reactivity.d.ts')) {
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
