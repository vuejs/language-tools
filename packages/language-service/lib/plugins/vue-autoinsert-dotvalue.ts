import type { LanguageServiceContext, LanguageServicePlugin, LanguageServicePluginInstance } from '@volar/language-service';
import { hyphenateAttr } from '@vue/language-core';
import type * as ts from 'typescript';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

const asts = new WeakMap<ts.IScriptSnapshot, ts.SourceFile>();

function getAst(ts: typeof import('typescript'), fileName: string, snapshot: ts.IScriptSnapshot, scriptKind?: ts.ScriptKind) {
	let ast = asts.get(snapshot);
	if (!ast) {
		ast = ts.createSourceFile(fileName, snapshot.getText(0, snapshot.getLength()), ts.ScriptTarget.Latest, undefined, scriptKind);
		asts.set(snapshot, ast);
	}
	return ast;
}

export function create(
	ts: typeof import('typescript'),
	getTsPluginClient?: (context: LanguageServiceContext) => typeof import('@vue/typescript-plugin/lib/client') | undefined
): LanguageServicePlugin {
	return {
		name: 'vue-autoinsert-dotvalue',
		capabilities: {
			autoInsertionProvider: {
				triggerCharacters: ['\\w'],
				configurationSections: ['vue.autoInsert.dotValue'],
			},
		},
		create(context): LanguageServicePluginInstance {
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

					const enabled = await context.env.getConfiguration?.<boolean>('vue.autoInsert.dotValue') ?? true;
					if (!enabled) {
						return;
					}

					const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (!sourceScript) {
						return;
					}

					let ast: ts.SourceFile | undefined;
					let sourceCodeOffset = document.offsetAt(selection);

					const fileName = context.project.typescript?.uriConverter.asFileName(sourceScript.id)
						?? sourceScript.id.fsPath.replace(/\\/g, '/');

					if (sourceScript.generated) {
						const serviceScript = sourceScript.generated.languagePlugin.typescript?.getServiceScript(sourceScript.generated.root);
						if (!serviceScript || serviceScript?.code !== virtualCode) {
							return;
						}
						ast = getAst(ts, fileName, virtualCode.snapshot, serviceScript.scriptKind);
						let mapped = false;
						for (const [_sourceScript, map] of context.language.maps.forEach(virtualCode)) {
							for (const [sourceOffset] of map.toSourceLocation(document.offsetAt(selection))) {
								sourceCodeOffset = sourceOffset;
								mapped = true;
								break;
							}
							if (mapped) {
								break;
							}
						}
						if (!mapped) {
							return;
						}
					}
					else {
						ast = getAst(ts, fileName, sourceScript.snapshot);
					}

					if (isBlacklistNode(ts, ast, document.offsetAt(selection), false)) {
						return;
					}

					const props = await tsPluginClient?.getPropertiesAtLocation(fileName, sourceCodeOffset) ?? [];
					if (props.some(prop => prop === 'value')) {
						return '${1:.value}';
					}
				},
			};
		},
	};
}

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function isTsDocument(document: TextDocument) {
	return document.languageId === 'javascript' ||
		document.languageId === 'typescript' ||
		document.languageId === 'javascriptreact' ||
		document.languageId === 'typescriptreact';
}

const charReg = /\w/;

export function isCharacterTyping(document: TextDocument, change: { text: string; rangeOffset: number; rangeLength: number; }) {
	const lastCharacter = change.text[change.text.length - 1];
	const nextCharacter = document.getText().substring(
		change.rangeOffset + change.text.length,
		change.rangeOffset + change.text.length + 1
	);
	if (lastCharacter === undefined) { // delete text
		return false;
	}
	if (change.text.indexOf('\n') >= 0) { // multi-line change
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
