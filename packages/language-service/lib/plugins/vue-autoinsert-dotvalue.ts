import type { ServicePlugin, ServicePluginInstance } from '@volar/language-service';
import { hyphenateAttr } from '@vue/language-core';
import * as namedPipeClient from '@vue/typescript-plugin/lib/client';
import type * as ts from 'typescript';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { getAst } from './typescript';

export function create(ts: typeof import('typescript')): ServicePlugin {
	return {
		name: 'vue-autoinsert-dotvalue',
		create(context): ServicePluginInstance {
			return {
				async provideAutoInsertionEdit(document, position, lastChange) {

					if (!isTsDocument(document))
						return;

					if (!isCharacterTyping(document, lastChange))
						return;

					const enabled = await context.env.getConfiguration?.<boolean>('vue.autoInsert.dotValue') ?? true;
					if (!enabled)
						return;

					const [_, file] = context.documents.getVirtualCodeByUri(document.uri);

					let fileName: string | undefined;
					let ast: ts.SourceFile | undefined;

					if (file?.generated) {
						const script = file.generated.languagePlugin.typescript?.getScript(file.generated.code);
						if (script) {
							fileName = context.env.typescript!.uriToFileName(file.id);
							ast = getAst(fileName, script.code.snapshot, script.scriptKind);
						}
					}
					else if (file) {
						fileName = context.env.typescript!.uriToFileName(file.id);
						ast = getAst(fileName, file.snapshot);
					}

					if (!ast || !fileName)
						return;

					if (isBlacklistNode(ts, ast, document.offsetAt(position), false))
						return;

					const props = await namedPipeClient.getPropertiesAtLocation(fileName, document.offsetAt(position)) ?? [];
					if (props.some(prop => prop === 'value')) {
						return '${1:.value}';
					}
				},
			};
		},
	};
}

function isTsDocument(document: TextDocument) {
	return document.languageId === 'javascript' ||
		document.languageId === 'typescript' ||
		document.languageId === 'javascriptreact' ||
		document.languageId === 'typescriptreact';
}

const charReg = /\w/;

export function isCharacterTyping(document: TextDocument, lastChange: { range: vscode.Range; text: string; }) {

	const lastCharacter = lastChange.text[lastChange.text.length - 1];
	const rangeStart = lastChange.range.start;
	const position: vscode.Position = {
		line: rangeStart.line,
		character: rangeStart.character + lastChange.text.length,
	};
	const nextCharacter = document.getText({
		start: position,
		end: { line: position.line, character: position.character + 1 },
	});

	if (lastCharacter === undefined) { // delete text
		return false;
	}
	if (lastChange.text.indexOf('\n') >= 0) { // multi-line change
		return false;
	}

	return charReg.test(lastCharacter) && !charReg.test(nextCharacter);
}

export function isBlacklistNode(ts: typeof import('typescript'), node: ts.Node, pos: number, allowAccessDotValue: boolean) {
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
	else if (ts.isTypeReferenceNode(node)) {
		return true;
	}
	else if (!allowAccessDotValue && ts.isPropertyAccessExpression(node) && node.expression.end === pos && node.name.text === 'value') {
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
				if (isBlacklistNode(ts, node, pos, allowAccessDotValue)) {
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
			|| hyphenateAttr(fnName).startsWith('use-');
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
