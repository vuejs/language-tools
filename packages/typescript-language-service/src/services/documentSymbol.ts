import type * as ts from 'typescript/lib/tsserverlibrary';
import * as PConst from '../protocol.const';
import * as vscode from 'vscode-languageserver-protocol';
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
	return (uri: string): vscode.SymbolInformation[] => {

		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.getPathOfUri(document.uri);

		let barItems: ReturnType<typeof languageService.getNavigationTree> | undefined;
		try { barItems = languageService.getNavigationTree(fileName); } catch { }
		if (!barItems) return [];

		// The root represents the file. Ignore this when showing in the UI
		const result: vscode.SymbolInformation[] = [];
		if (barItems.childItems) {
			for (const item of barItems.childItems) {
				convertNavTree(document, item, undefined);
			}
		}

		return result;

		function convertNavTree(
			document: TextDocument,
			item: ts.NavigationTree,
			parent: ts.NavigationTree | undefined,
		): boolean {
			let shouldInclude = shouldInclueEntry(item);
			if (!shouldInclude && !item.childItems?.length) {
				return false;
			}

			for (const span of item.spans) {
				const range = vscode.Range.create(document.positionAt(span.start), document.positionAt(span.start + span.length));
				const symbolInfo = vscode.SymbolInformation.create(
					item.text,
					getSymbolKind(item.kind),
					range,
					document.uri,
					parent?.text,
				);

				if (item.childItems) {
					for (const child of item.childItems) {
						convertNavTree(document, child, item);
					}
				}

				const kindModifiers = parseKindModifier(item.kindModifiers);
				if (kindModifiers.has(PConst.KindModifiers.deprecated)) {
					symbolInfo.deprecated = true;
					if (!symbolInfo.tags) symbolInfo.tags = [];
					symbolInfo.tags.push(vscode.SymbolTag.Deprecated);
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
