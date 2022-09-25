import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { hyphenate } from '@vue/shared';
import { isTsDocument } from '@volar-plugins/typescript';
import { LanguageServicePlugin, LanguageServicePluginContext } from '@volar/language-service';

export default function (): LanguageServicePlugin {

	let context: LanguageServicePluginContext;

	return {

		setup(_context) {
			context = _context;
		},

		async doAutoInsert(document, position, insertContext) {

			if (!isTsDocument(document))
				return;

			if (!isCharacterTyping(document, insertContext))
				return;

			const enabled = await context.env.configurationHost?.getConfiguration<boolean>('volar.autoCompleteRefs') ?? true;
			if (!enabled)
				return;

			const program = context.typescript.languageService.getProgram();
			if (!program)
				return;

			const sourceFile = program.getSourceFile(shared.getPathOfUri(document.uri));
			if (!sourceFile)
				return;

			if (isBlacklistNode(context.typescript.module, sourceFile, document.offsetAt(position), false))
				return;

			const node = findPositionIdentifier(sourceFile, sourceFile, document.offsetAt(position));
			if (!node)
				return;

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
						if (child.end === offset && context.typescript.module.isIdentifier(child)) {
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
}

export function isCharacterTyping(document: TextDocument, options: Parameters<NonNullable<LanguageServicePlugin['doAutoInsert']>>[2]) {

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
