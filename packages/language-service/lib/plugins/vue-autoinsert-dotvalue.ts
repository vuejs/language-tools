import type { LanguageServicePlugin, TextDocument } from '@volar/language-service';
import { hyphenateAttr } from '@vue/language-core';
import type * as ts from 'typescript';
import { resolveEmbeddedCode } from '../utils';

export function create(
	ts: typeof import('typescript'),
	{ isRefAtLocation }: import('@vue/typescript-plugin/lib/requests').Requests,
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
					if (!info?.code.id.startsWith('script_')) {
						return;
					}

					// selection must at end of change
					if (document.offsetAt(selection) !== change.rangeOffset + change.text.length) {
						return;
					}

					if (!isCharacterTyping(document, change)) {
						return;
					}

					let sourceOffset: number | undefined;

					const { sfc } = info.root;
					const scriptBlocks = [sfc.script, sfc.scriptSetup].filter(block => !!block);
					const map = context.language.maps.get(info.code, info.script);

					if (!scriptBlocks.length) {
						return;
					}

					for (const [offset] of map.toSourceLocation(document.offsetAt(selection))) {
						sourceOffset = offset;
						break;
					}

					if (sourceOffset === undefined) {
						return;
					}

					for (const { ast, startTagEnd, endTagStart } of scriptBlocks) {
						if (sourceOffset < startTagEnd || sourceOffset > endTagStart) {
							continue;
						}
						if (isBlacklistNode(ts, ast, sourceOffset - startTagEnd, false)) {
							return;
						}
					}

					if (await isRefAtLocation(info.root.fileName, sourceOffset)) {
						return '${1:.value}';
					}
				},
			};
		},
	};
}

const charReg = /\w/;

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
	return charReg.test(lastCharacter) && !charReg.test(nextCharacter);
}

function isBlacklistNode(ts: typeof import('typescript'), node: ts.Node, pos: number, allowAccessDotValue: boolean) {
	if (ts.isVariableDeclaration(node) && pos >= node.name.getFullStart() && pos <= node.name.getEnd()) {
		return true;
	}
	else if (
		ts.isFunctionDeclaration(node) && node.name && pos >= node.name.getFullStart() && pos <= node.name.getEnd()
	) {
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
		&& isTopLevelArgOrArrayTopLevelItemItem(node)
	) {
		return true;
	}
	else {
		let _isBlacklistNode = false;
		node.forEachChild(node => {
			if (_isBlacklistNode) {
				return;
			}
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
