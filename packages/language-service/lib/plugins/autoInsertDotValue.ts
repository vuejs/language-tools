import type { LanguageServicePlugin, TextDocument } from '@volar/language-service';
import { hyphenateAttr, isParameter, type ts, type TypeScript } from '@vue/language-core';
import { resolveEmbeddedCode } from '../virtualCodeQueries';

export function create(
	{ isRefAtPosition }: import('../requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'vue-autoinsert-dotvalue',
		capabilities: {
			autoInsertionProvider: {
				triggerCharacters: ['\\w'],
				configurationSections: ['vue.autoInsert.dotValue'],
			},
		},
		create(context) {
			return {
				async provideAutoInsertSnippet(document, selection, change) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'main') {
						return;
					}

					// selection must at end of change
					if (document.offsetAt(selection) !== change.rangeOffset + change.text.length) {
						return;
					}

					if (!isCharacterTyping(document, change)) {
						return;
					}

					const { ir } = info.root;
					const offset = document.offsetAt(selection);
					const block = [ir.script, ir.scriptSetup].find(block =>
						block && offset >= block.startTagEnd && offset <= block.endTagStart
					);
					if (!block) {
						return;
					}

					if (shouldSkip(info.root.ts, block.ast, offset - block.startTagEnd, false)) {
						return;
					}

					if (await isRefAtPosition(info.root.fileName, offset)) {
						return '${1:.value}';
					}
				},
			};
		},
	};
}

const charRE = /\w/;

function isCharacterTyping(document: TextDocument, change: { text: string; rangeOffset: number; rangeLength: number }) {
	const lastCharacter = change.text[change.text.length - 1];
	const nextCharacter = document.getText().slice(
		change.rangeOffset + change.text.length,
		change.rangeOffset + change.text.length + 1,
	);
	if (lastCharacter === undefined) { // delete text
		return false;
	}
	if (change.text.includes('\n')) { // multi-line change
		return false;
	}
	return charRE.test(lastCharacter) && !charRE.test(nextCharacter);
}

function shouldSkip(ts: TypeScript, node: ts.Node, pos: number, allowAccessDotValue: boolean) {
	if (ts.isVariableDeclaration(node) && pos >= node.name.getFullStart() && pos <= node.name.getEnd()) {
		return true;
	}
	else if (
		ts.isFunctionDeclaration(node) && node.name && pos >= node.name.getFullStart() && pos <= node.name.getEnd()
	) {
		return true;
	}
	else if (isParameter(ts, node) && pos >= node.name.getFullStart() && pos <= node.name.getEnd()) {
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
	else if (
		!allowAccessDotValue && ts.isPropertyAccessExpression(node) && node.expression.end === pos
		&& node.name.text === 'value'
	) {
		return true;
	}
	else if (
		ts.isCallExpression(node)
		&& ts.isIdentifier(node.expression)
		&& isWatchOrUseFunction(node.expression.text)
		&& isTopLevelArgOrArrayTopLevelItemItem(ts, node, pos)
	) {
		return true;
	}
	else {
		let _shouldSkip = false;
		node.forEachChild(node => {
			if (_shouldSkip) {
				return;
			}
			if (pos >= node.getFullStart() && pos <= node.getEnd()) {
				if (shouldSkip(ts, node, pos, allowAccessDotValue)) {
					_shouldSkip = true;
				}
			}
		});
		return _shouldSkip;
	}
}

function isWatchOrUseFunction(fnName: string) {
	return fnName === 'watch'
		|| fnName === 'unref'
		|| fnName === 'triggerRef'
		|| fnName === 'isRef'
		|| hyphenateAttr(fnName).startsWith('use-');
}

function isTopLevelArgOrArrayTopLevelItemItem(ts: TypeScript, node: ts.CallExpression, pos: number) {
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
