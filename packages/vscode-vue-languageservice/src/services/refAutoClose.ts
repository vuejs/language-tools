import type { ApiLanguageServiceContext } from '../types';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import * as shared from '@volar/shared';
import type * as ts2 from 'vscode-typescript-languageservice';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { hyphenate } from '@vue/shared';

export function register({ modules: { typescript: ts }, sourceFiles, getTsLs }: ApiLanguageServiceContext) {

	const asts = new WeakMap<TextDocument, ts.SourceFile>();

	return (document: TextDocument, position: vscode.Position): string | undefined | null => {

		for (const tsLoc of sourceFiles.toTsLocations(
			document.uri,
			position,
			position,
			data => !!data.capabilities.completion,
		)) {

			if (tsLoc.lsType === 'template')
				continue;

			if (tsLoc.type === 'source-ts' && tsLoc.lsType !== 'script')
				continue;

			const tsLs = getTsLs(tsLoc.lsType);
			const tsDoc = tsLs.__internal__.getTextDocument(tsLoc.uri);
			if (!tsDoc)
				continue;

			const sourceFile = getAst(tsDoc);
			if (isBlacklistNode(ts, sourceFile, tsDoc.offsetAt(tsLoc.range.start)))
				continue;

			const typeDefs = tsLs.findTypeDefinition(tsLoc.uri, tsLoc.range.start);
			if (isRefType(typeDefs, tsLs)) {
				return '${1:.value}';
			}
		}
	}

	function getAst(tsDoc: TextDocument) {
		let ast = asts.get(tsDoc);
		if (!ast) {
			ast = ts.createSourceFile(shared.uriToFsPath(tsDoc.uri), tsDoc.getText(), ts.ScriptTarget.Latest);
			asts.set(tsDoc, ast);
		}
		return ast;
	}
}

export function isBlacklistNode(ts: typeof import('typescript/lib/tsserverlibrary'), node: ts.Node, pos: number) {
	if (ts.isVariableDeclaration(node) && pos >= node.name.getFullStart() && pos <= node.name.getEnd()) {
		return true;
	}
	else if (ts.isFunctionDeclaration(node) && node.name && pos >= node.name.getFullStart() && pos <= node.name.getEnd()) {
		return true;
	}
	else if (ts.isParameter(node) && pos >= node.name.getFullStart() && pos <= node.name.getEnd()) {
		return true;
	}
	else if (ts.isPropertyAssignment(node) && pos >= node.name.getFullStart() && pos <= node.name.getEnd()) {
		return true;
	}
	else if (ts.isShorthandPropertyAssignment(node)) {
		return true;
	}
	else if (ts.isImportDeclaration(node)) {
		return true;
	}
	else if (ts.isLiteralTypeNode(node)) {
		return true;
	}
	else if (ts.isPropertyAccessExpression(node) && node.name.text === 'value') {
		return true;
	}
	else if (
		ts.isCallExpression(node)
		&& ts.isIdentifier(node.expression)
		&& isWatchOrUseFunction(node.expression.text)
		&& isTopLevelArgOrArrayTopLevelItemItem(node)
	) {
		return true;
	}
	else {
		let _isBlacklistNode = false;
		node.forEachChild(node => {
			if (_isBlacklistNode) return;
			if (pos >= node.getFullStart() && pos <= node.getEnd()) {
				if (isBlacklistNode(ts, node, pos)) {
					_isBlacklistNode = true;
				}
			}
		});
		return _isBlacklistNode;
	}

	function isWatchOrUseFunction(fnName: string) {
		return fnName === 'watch'
			|| fnName === 'unref'
			|| fnName === 'triggerRef'
			|| fnName === 'isRef'
			|| hyphenate(fnName).startsWith('use-');
	}
	function isTopLevelArgOrArrayTopLevelItemItem(node: ts.CallExpression) {
		for (const arg of node.arguments) {
			if (pos >= arg.getFullStart() && pos <= arg.getEnd()) {
				if (ts.isIdentifier(arg)) {
					return true;
				}
				if (ts.isArrayLiteralExpression(arg)) {
					for (const el of arg.elements) {
						if (pos >= el.getFullStart() && pos <= el.getEnd()) {
							return ts.isIdentifier(el);
						}
					}
				}
				return false;
			}
		}
	}
}
export function isRefType(typeDefs: vscode.LocationLink[], tsLs: ts2.LanguageService) {
	for (const typeDefine of typeDefs) {
		const uri = vscode.Location.is(typeDefine) ? typeDefine.uri : typeDefine.targetUri;
		const range = vscode.Location.is(typeDefine) ? typeDefine.range : typeDefine.targetSelectionRange;
		if (uri.endsWith('reactivity.d.ts')) {
			const defineDoc = tsLs.__internal__.getTextDocument(uri);
			if (!defineDoc)
				continue;
			const typeName = defineDoc.getText(range);
			switch (typeName) {
				case 'Ref':
				case 'ComputedRef':
				case 'WritableComputedRef':
					return true;
			}
		}
	}
	return false;
}
