import type * as ts from 'typescript';
import * as PConst from '../protocol.const';
import * as vscode from 'vscode-languageserver';
import { parseKindModifier } from '../utils/modifiers';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

const getSymbolKind = (kind: string): vscode.SymbolKind => {
	switch (kind) {
		case PConst.Kind.module: return vscode.SymbolKind.Module;
		case PConst.Kind.class: return vscode.SymbolKind.Class;
		case PConst.Kind.enum: return vscode.SymbolKind.Enum;
		case PConst.Kind.interface: return vscode.SymbolKind.Interface;
		case PConst.Kind.method: return vscode.SymbolKind.Method;
		case PConst.Kind.memberVariable: return vscode.SymbolKind.Property;
		case PConst.Kind.memberGetAccessor: return vscode.SymbolKind.Property;
		case PConst.Kind.memberSetAccessor: return vscode.SymbolKind.Property;
		case PConst.Kind.variable: return vscode.SymbolKind.Variable;
		case PConst.Kind.const: return vscode.SymbolKind.Variable;
		case PConst.Kind.localVariable: return vscode.SymbolKind.Variable;
		case PConst.Kind.function: return vscode.SymbolKind.Function;
		case PConst.Kind.localFunction: return vscode.SymbolKind.Function;
		case PConst.Kind.constructSignature: return vscode.SymbolKind.Constructor;
		case PConst.Kind.constructorImplementation: return vscode.SymbolKind.Constructor;
	}
	return vscode.SymbolKind.Variable;
};

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string): vscode.DocumentSymbol[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.uriToFsPath(document.uri);
		const barItems = languageService.getNavigationTree(fileName);
		const result: vscode.DocumentSymbol[] = [];
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
				const range = vscode.Range.create(document.positionAt(span.start), document.positionAt(span.start + span.length));
				const selectionRange = item.nameSpan ? vscode.Range.create(document.positionAt(item.nameSpan.start), document.positionAt(item.nameSpan.start + item.nameSpan.length)) : range;
				const symbolInfo = vscode.DocumentSymbol.create(
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
