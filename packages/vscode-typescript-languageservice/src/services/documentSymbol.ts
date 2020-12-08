import * as ts from 'typescript';
import * as PConst from '../protocol.const';
import {
	TextDocument,
	Range,
	SymbolKind,
	DocumentSymbol,
} from 'vscode-languageserver/node';
import { parseKindModifier } from '../utils/modifiers';
import { uriToFsPath } from '@volar/shared';

const getSymbolKind = (kind: string): SymbolKind => {
	switch (kind) {
		case PConst.Kind.module: return SymbolKind.Module;
		case PConst.Kind.class: return SymbolKind.Class;
		case PConst.Kind.enum: return SymbolKind.Enum;
		case PConst.Kind.interface: return SymbolKind.Interface;
		case PConst.Kind.method: return SymbolKind.Method;
		case PConst.Kind.memberVariable: return SymbolKind.Property;
		case PConst.Kind.memberGetAccessor: return SymbolKind.Property;
		case PConst.Kind.memberSetAccessor: return SymbolKind.Property;
		case PConst.Kind.variable: return SymbolKind.Variable;
		case PConst.Kind.const: return SymbolKind.Variable;
		case PConst.Kind.localVariable: return SymbolKind.Variable;
		case PConst.Kind.function: return SymbolKind.Function;
		case PConst.Kind.localFunction: return SymbolKind.Function;
		case PConst.Kind.constructSignature: return SymbolKind.Constructor;
		case PConst.Kind.constructorImplementation: return SymbolKind.Constructor;
	}
	return SymbolKind.Variable;
};

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string): DocumentSymbol[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = uriToFsPath(document.uri);
		const barItems = languageService.getNavigationTree(fileName);
		const result: DocumentSymbol[] = [];
		convertNavTree(document, barItems);

		return result;

		function convertNavTree(
			document: TextDocument,
			item: ts.NavigationTree,
		): boolean {
			let shouldInclude = shouldInclueEntry(item);
			if (!shouldInclude && !item.childItems?.length) {
				return false;
			}

			for (const span of item.spans) {
				const range = Range.create(document.positionAt(span.start), document.positionAt(span.start + span.length));
				const selectionRange = item.nameSpan ? Range.create(document.positionAt(item.nameSpan.start), document.positionAt(item.nameSpan.start + item.nameSpan.length)) : range;
				const symbolInfo = DocumentSymbol.create(
					item.text,
					'',
					getSymbolKind(item.kind),
					range,
					selectionRange);

				const kindModifiers = parseKindModifier(item.kindModifiers);
				if (kindModifiers.has(PConst.KindModifiers.depreacted)) {
					symbolInfo.deprecated = true;
				}

				if (shouldInclude) {
					result.push(symbolInfo);
				}
			}

			return shouldInclude;
		}
		function shouldInclueEntry(item: ts.NavigationTree): boolean {
			if (item.kind === PConst.Kind.alias) {
				return false;
			}
			return !!(item.text && item.text !== '<function>' && item.text !== '<class>');
		}
	};
}
