import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';
import * as ts2 from '@volar/typescript-language-service';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { hyphenate } from '@vue/shared';
import { isTsDocument } from './typescript';
import { EmbeddedLanguageServicePlugin, useConfigurationHost } from '@volar/vue-language-service-types';

export default function (options: {
	ts: typeof import('typescript/lib/tsserverlibrary'),
	getTsLs: () => ts2.LanguageService,
}): EmbeddedLanguageServicePlugin {

	const asts = new WeakMap<TextDocument, ts.SourceFile>();

	return {

		async doAutoInsert(document, position, context) {

			if (!isTsDocument(document))
				return;

			if (!isCharacterTyping(document, context))
				return;

			const enabled = await useConfigurationHost()?.getConfiguration<boolean>('volar.autoCompleteRefs') ?? true;
			if (!enabled)
				return;

			const sourceFile = getAst(document);
			if (isBlacklistNode(options.ts, sourceFile, document.offsetAt(position)))
				return;

			const typeDefs = options.getTsLs().findTypeDefinition(document.uri, position);
			if (isRefType(typeDefs, options.getTsLs())) {
				return '${1:.value}';
			}
		},
	};

	function getAst(tsDoc: TextDocument) {
		let ast = asts.get(tsDoc);
		if (!ast) {
			ast = options.ts.createSourceFile(shared.uriToFsPath(tsDoc.uri), tsDoc.getText(), options.ts.ScriptTarget.Latest);
			asts.set(tsDoc, ast);
		}
		return ast;
	}
}

export function isCharacterTyping(document: TextDocument, options: Parameters<NonNullable<EmbeddedLanguageServicePlugin['doAutoInsert']>>[2]) {

	const lastCharacter = options.lastChange.text[options.lastChange.text.length - 1];
	const rangeStart = options.lastChange.range.start;
	const position = vscode.Position.create(rangeStart.line, rangeStart.character + options.lastChange.text.length);
	const nextCharacter = document.getText(vscode.Range.create(position, document.positionAt(document.offsetAt(position) + 1)));

	if (lastCharacter === undefined) { // delete text
		return false;
	}
	if (options.lastChange.text.indexOf('\n') >= 0) { // multi-line change
		return false;
	}

	return /\w/.test(lastCharacter) && !/\w/.test(nextCharacter);
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
