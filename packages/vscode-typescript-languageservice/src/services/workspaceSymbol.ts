import type * as ts from 'typescript';
import * as PConst from '../protocol.const';
import * as vscode from 'vscode-languageserver';
import { parseKindModifier } from '../utils/modifiers';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

function getSymbolKind(item: ts.NavigationBarItem): vscode.SymbolKind {
	switch (item.kind) {
		case PConst.Kind.module: return vscode.SymbolKind.Module;
		case PConst.Kind.method: return vscode.SymbolKind.Method;
		case PConst.Kind.enum: return vscode.SymbolKind.Enum;
		case PConst.Kind.enumMember: return vscode.SymbolKind.EnumMember;
		case PConst.Kind.function: return vscode.SymbolKind.Function;
		case PConst.Kind.class: return vscode.SymbolKind.Class;
		case PConst.Kind.interface: return vscode.SymbolKind.Interface;
		case PConst.Kind.type: return vscode.SymbolKind.Class;
		case PConst.Kind.memberVariable: return vscode.SymbolKind.Field;
		case PConst.Kind.memberGetAccessor: return vscode.SymbolKind.Field;
		case PConst.Kind.memberSetAccessor: return vscode.SymbolKind.Field;
		case PConst.Kind.variable: return vscode.SymbolKind.Variable;
		default: return vscode.SymbolKind.Variable;
	}
}

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string): vscode.SymbolInformation[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.uriToFsPath(document.uri);
		const barItems = languageService.getNavigationBarItems(fileName);
		const output: vscode.SymbolInformation[] = [];
		barItemsWorker(document, barItems);

		return output;

		function barItemsWorker(document: TextDocument, barItems: ts.NavigationBarItem[], parentName?: string) {
			for (const barItem of barItems) {
				barItemWorker(document, barItem, parentName);
			}
		}
		function barItemWorker(document: TextDocument, barItem: ts.NavigationBarItem, parentName?: string) {
			for (const span of barItem.spans) {
				const item = toSymbolInformation(document, barItem, span, parentName);
				output.push(item);
				barItemsWorker(document, barItem.childItems, barItem.text);
			}
		}
		function toSymbolInformation(document: TextDocument, item: ts.NavigationBarItem, span: ts.TextSpan, containerName?: string) {
			const label = getLabel(item);
			const info = vscode.SymbolInformation.create(
				label,
				getSymbolKind(item),
				vscode.Range.create(document.positionAt(span.start), document.positionAt(span.start + span.length)),
				document.uri,
				containerName,
			);
			const kindModifiers = item.kindModifiers ? parseKindModifier(item.kindModifiers) : undefined;
			if (kindModifiers?.has(PConst.KindModifiers.depreacted)) {
				info.deprecated = true;
			}
			return info;
		}
		function getLabel(item: ts.NavigationBarItem) {
			const label = item.text;
			if (item.kind === 'method' || item.kind === 'function') {
				return label + '()';
			}
			return label;
		}
	};
}
