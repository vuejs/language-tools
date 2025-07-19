import type { LanguageServiceContext, LanguageServicePlugin, TextDocument } from '@volar/language-service';
import { hyphenateAttr, VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import { URI } from 'vscode-uri';
import { isTsDocument, sleep } from './utils';

export function create(
	ts: typeof import('typescript'),
	getTsPluginClient?: (
		context: LanguageServiceContext,
	) => import('@vue/typescript-plugin/lib/requests').Requests | undefined,
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
			const tsPluginClient = getTsPluginClient?.(context);
			let currentReq = 0;

			return {
				async provideAutoInsertSnippet(document, selection, change) {
					// selection must at end of change
					if (document.offsetAt(selection) !== change.rangeOffset + change.text.length) {
						return;
					}

					if (!isTsDocument(document)) {
						return;
					}

					if (!isCharacterTyping(document, change)) {
						return;
					}

					const req = ++currentReq;
					// Wait for tsserver to sync
					await sleep(250);
					if (req !== currentReq) {
						return;
					}

					const enabled = await context.env.getConfiguration<boolean>?.('vue.autoInsert.dotValue') ?? true;
					if (!enabled) {
						return;
					}

					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (!sourceScript?.generated || !virtualCode) {
						return;
					}

					const root = sourceScript.generated.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					const { sfc } = root;
					const blocks = [sfc.script, sfc.scriptSetup].filter(block => !!block);
					if (!blocks.length) {
						return;
					}

					let sourceOffset: number | undefined;
					const map = context.language.maps.get(virtualCode, sourceScript);
					for (const [offset] of map.toSourceLocation(document.offsetAt(selection))) {
						sourceOffset = offset;
						break;
					}
					if (sourceOffset === undefined) {
						return;
					}

					for (const { ast, startTagEnd, endTagStart } of blocks) {
						if (sourceOffset < startTagEnd || sourceOffset > endTagStart) {
							continue;
						}
						if (isBlacklistNode(ts, ast, sourceOffset - startTagEnd, false)) {
							return;
						}
					}

					const props = await tsPluginClient?.getPropertiesAtLocation(root.fileName, sourceOffset) ?? [];
					if (props.some(prop => prop === 'value')) {
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
