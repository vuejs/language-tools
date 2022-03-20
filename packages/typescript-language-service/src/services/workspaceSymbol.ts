import type * as ts from 'typescript/lib/tsserverlibrary';
import * as PConst from '../protocol.const';
import * as vscode from 'vscode-languageserver-protocol';
import { parseKindModifier } from '../utils/modifiers';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

function getSymbolKind(item: ts.NavigateToItem): vscode.SymbolKind {
	switch (item.kind) {
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

export function register(languageService: ts.LanguageService, getTextDocument2: (uri: string) => TextDocument | undefined) {
	return (query: string): vscode.SymbolInformation[] => {

		let items: ReturnType<typeof languageService.getNavigateToItems> | undefined;
		try { items = languageService.getNavigateToItems(query) } catch { }
		if (!items) return [];

		return items
			.filter(item => item.containerName || item.kind !== 'alias')
			.map(toSymbolInformation)
			.filter(shared.notEmpty);

		function toSymbolInformation(item: ts.NavigateToItem) {
			const label = getLabel(item);
			const document = getTextDocument2(item.fileName);
			if (document) {
				const range = vscode.Range.create(document.positionAt(item.textSpan.start), document.positionAt(item.textSpan.start + item.textSpan.length));
				const info = vscode.SymbolInformation.create(
					label,
					getSymbolKind(item),
					range,
					item.fileName,
					item.containerName || '',
				);
				const kindModifiers = item.kindModifiers ? parseKindModifier(item.kindModifiers) : undefined;
				if (kindModifiers?.has(PConst.KindModifiers.deprecated)) {
					info.tags = [vscode.SymbolTag.Deprecated];
				}
				return info;
			}
		}

		function getLabel(item: ts.NavigateToItem) {
			const label = item.name;
			if (item.kind === 'method' || item.kind === 'function') {
				return label + '()';
			}
			return label;
		}
	};
}
