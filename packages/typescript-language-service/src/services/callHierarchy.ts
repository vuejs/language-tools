import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver-protocol';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { posix as path } from 'path';
import * as PConst from '../protocol.const';
import { parseKindModifier } from '../utils/modifiers';
import * as typeConverters from '../utils/typeConverters';
import * as upath from 'upath';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	function doPrepare(uri: string, position: vscode.Position) {

		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.uriToFsPath(document.uri);
		const offset = document.offsetAt(position);

		let calls: ReturnType<typeof languageService.prepareCallHierarchy> | undefined;
		try { calls = languageService.prepareCallHierarchy(fileName, offset); } catch { }
		if (!calls) return [];

		const items = Array.isArray(calls) ? calls : [calls];
		return items.map(item => fromProtocolCallHierarchyItem(item));
	}
	function getIncomingCalls(item: vscode.CallHierarchyItem) {

		const document = getTextDocument(item.uri);
		if (!document) return [];

		const fileName = shared.uriToFsPath(item.uri);
		const offset = document.offsetAt(item.selectionRange.start);

		let calls: ReturnType<typeof languageService.provideCallHierarchyIncomingCalls> | undefined;
		try { calls = languageService.provideCallHierarchyIncomingCalls(fileName, offset); } catch { }
		if (!calls) return [];

		const items = Array.isArray(calls) ? calls : [calls];
		return items.map(item => fromProtocolCallHierchyIncomingCall(item));
	}
	function getOutgoingCalls(item: vscode.CallHierarchyItem) {

		const document = getTextDocument(item.uri);
		if (!document) return [];

		const fileName = shared.uriToFsPath(item.uri);
		const offset = document.offsetAt(item.selectionRange.start);

		let calls: ReturnType<typeof languageService.provideCallHierarchyOutgoingCalls> | undefined;
		try { calls = languageService.provideCallHierarchyOutgoingCalls(fileName, offset); } catch { }
		if (!calls) return [];

		const items = Array.isArray(calls) ? calls : [calls];
		return items.map(item => fromProtocolCallHierchyOutgoingCall(item, document));
	}

	return {
		doPrepare,
		getIncomingCalls,
		getOutgoingCalls,
	};

	function isSourceFileItem(item: ts.CallHierarchyItem) {
		return item.kind === PConst.Kind.script || item.kind === PConst.Kind.module && item.selectionSpan.start === 0;
	}

	function fromProtocolCallHierarchyItem(item: ts.CallHierarchyItem): vscode.CallHierarchyItem {
		const rootPath = languageService.getProgram()?.getCompilerOptions().rootDir ?? '';
		const document = getTextDocument(shared.fsPathToUri(item.file))!; // TODO
		const useFileName = isSourceFileItem(item);
		const name = useFileName ? path.basename(item.file) : item.name;
		const detail = useFileName ? upath.relative(rootPath, path.dirname(item.file)) : item.containerName ?? '';
		const result: vscode.CallHierarchyItem = {
			kind: typeConverters.SymbolKind.fromProtocolScriptElementKind(item.kind),
			name,
			detail,
			uri: shared.fsPathToUri(item.file),
			range: {
				start: document.positionAt(item.span.start),
				end: document.positionAt(item.span.start + item.span.length),
			},
			selectionRange: {
				start: document.positionAt(item.selectionSpan.start),
				end: document.positionAt(item.selectionSpan.start + item.selectionSpan.length),
			},
		};

		const kindModifiers = item.kindModifiers ? parseKindModifier(item.kindModifiers) : undefined;
		if (kindModifiers?.has(PConst.KindModifiers.deprecated)) {
			result.tags = [vscode.SymbolTag.Deprecated];
		}
		return result;
	}

	function fromProtocolCallHierchyIncomingCall(item: ts.CallHierarchyIncomingCall): vscode.CallHierarchyIncomingCall {
		const document = getTextDocument(shared.fsPathToUri(item.from.file))!;
		return {
			from: fromProtocolCallHierarchyItem(item.from),
			fromRanges: item.fromSpans.map(fromSpan => ({
				start: document.positionAt(fromSpan.start),
				end: document.positionAt(fromSpan.start + fromSpan.length),
			})),
		};
	}

	function fromProtocolCallHierchyOutgoingCall(item: ts.CallHierarchyOutgoingCall, document: TextDocument): vscode.CallHierarchyOutgoingCall {
		return {
			to: fromProtocolCallHierarchyItem(item.to),
			fromRanges: item.fromSpans.map(fromSpan => ({
				start: document.positionAt(fromSpan.start),
				end: document.positionAt(fromSpan.start + fromSpan.length),
			})),
		};
	}
};
