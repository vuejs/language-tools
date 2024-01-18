import { ServicePlugin, ServicePluginInstance } from '@volar/language-service';
import { hyphenateAttr } from '@vue/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { Provide } from 'volar-service-typescript';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function create(ts: typeof import('typescript/lib/tsserverlibrary')): ServicePlugin {
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

					const program = context.inject<Provide, 'typescript/languageService'>('typescript/languageService').getProgram();
					if (!program)
						return;

					const sourceFile = program.getSourceFile(context.env.typescript.uriToFileName(document.uri));
					if (!sourceFile)
						return;

					if (isBlacklistNode(ts, sourceFile, document.offsetAt(position), false))
						return;

					const node = findPositionIdentifier(sourceFile, sourceFile, document.offsetAt(position));
					if (!node)
						return;

					const token = context.inject<Provide, 'typescript/languageServiceHost'>('typescript/languageServiceHost').getCancellationToken?.();
					if (token) {
						context.inject<Provide, 'typescript/languageService'>('typescript/languageService').getQuickInfoAtPosition(context.env.typescript.uriToFileName(document.uri), node.end);
						if (token?.isCancellationRequested()) {
							return; // check cancel here because type checker do not use cancel token
						}
					}

					const checker = program.getTypeChecker();
					const type = checker.getTypeAtLocation(node);
					const props = type.getProperties();

					if (props.some(prop => prop.name === 'value')) {
						return '${1:.value}';
					}

					function findPositionIdentifier(sourceFile: ts.SourceFile, node: ts.Node, offset: number) {

						let result: ts.Node | undefined;

						node.forEachChild(child => {
							if (!result) {
								if (child.end === offset && ts.isIdentifier(child)) {
									result = child;
								}
								else if (child.end >= offset && child.getStart(sourceFile) < offset) {
									result = findPositionIdentifier(sourceFile, child, offset);
								}
							}
						});

						return result;
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

export function isBlacklistNode(ts: typeof import('typescript/lib/tsserverlibrary'), node: ts.Node, pos: number, allowAccessDotValue: boolean) {
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
