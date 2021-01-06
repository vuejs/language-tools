/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Range, CancellationToken, /* SemanticTokensBuilder */ } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts from 'typescript';
import { uriToFsPath } from '@volar/shared';
import { TokenEncodingConsts, TokenType, TokenModifier } from 'typescript-vscode-sh-plugin/lib/constants';

export function getSemanticTokenLegend() {
	if (tokenTypes.length !== TokenType._) {
		console.warn('TokenType has added new entries.');
	}
	if (tokenModifiers.length !== TokenModifier._) {
		console.warn('TokenModifier has added new entries.');
	}
	return { types: tokenTypes, modifiers: tokenModifiers };
}

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, range: Range, cancle?: CancellationToken) => {

		const document = getTextDocument(uri);
		if (!document) return;

		const file = uriToFsPath(uri);
		const start = document.offsetAt(range.start);
		const length = document.offsetAt(range.end) - start;

		if (cancle?.isCancellationRequested) return;
		const response1 = languageService.getEncodedSemanticClassifications(file, { start, length });
		if (cancle?.isCancellationRequested) return;
		const response2 = languageService.getEncodedSyntacticClassifications(file, { start, length });

		const tokenSpan = [...response1.spans, ...response2.spans];

		// const builder = new SemanticTokensBuilder();
		const tokens: [number, number, number, number, number][] = [];
		let i = 0;
		while (i < tokenSpan.length) {
			const offset = tokenSpan[i++];
			const length = tokenSpan[i++];
			const tsClassification = tokenSpan[i++];

			let tokenModifiers = 0;
			let tokenType = getTokenTypeFromClassification(tsClassification);
			if (tokenType !== undefined) {
				// it's a classification as returned by the typescript-vscode-sh-plugin
				tokenModifiers = getTokenModifierFromClassification(tsClassification);
			} else {
				// typescript-vscode-sh-plugin is not present
				tokenType = tokenTypeMap[tsClassification];
				if (tokenType === undefined) {
					continue;
				}
			}

			// we can use the document's range conversion methods because the result is at the same version as the document
			const startPos = document.positionAt(offset);
			const endPos = document.positionAt(offset + length);

			for (let line = startPos.line; line <= endPos.line; line++) {
				const startCharacter = (line === startPos.line ? startPos.character : 0);
				const endCharacter = (line === endPos.line ? endPos.character : docLineLength(document, line));
				// builder.push(line, startCharacter, endCharacter - startCharacter, tokenType, tokenModifiers);
				tokens.push([line, startCharacter, endCharacter - startCharacter, tokenType, tokenModifiers]);
			}
		}
		// return builder.build();
		return tokens;
	}
}

function docLineLength(document: TextDocument, line: number) {
	const currentLineOffset = document.offsetAt({ line, character: 0 });
	const nextLineOffset = document.offsetAt({ line: line + 1, character: 0 });
	return nextLineOffset - currentLineOffset;
}

// typescript-vscode-sh-plugin encodes type and modifiers in the classification:
// TSClassification = (TokenType + 1) << 8 + TokenModifier

function getTokenTypeFromClassification(tsClassification: number): number | undefined {
	if (tsClassification > TokenEncodingConsts.modifierMask) {
		return (tsClassification >> TokenEncodingConsts.typeOffset) - 1;
	}
	return undefined;
}

function getTokenModifierFromClassification(tsClassification: number) {
	return tsClassification & TokenEncodingConsts.modifierMask;
}

const tokenTypes: string[] = [];
tokenTypes[TokenType.class] = 'class';
tokenTypes[TokenType.enum] = 'enum';
tokenTypes[TokenType.interface] = 'interface';
tokenTypes[TokenType.namespace] = 'namespace';
tokenTypes[TokenType.typeParameter] = 'typeParameter';
tokenTypes[TokenType.type] = 'type';
tokenTypes[TokenType.parameter] = 'parameter';
tokenTypes[TokenType.variable] = 'variable';
tokenTypes[TokenType.enumMember] = 'enumMember';
tokenTypes[TokenType.property] = 'property';
tokenTypes[TokenType.function] = 'function';
tokenTypes[TokenType.member] = 'member';

const tokenModifiers: string[] = [];
tokenModifiers[TokenModifier.async] = 'async';
tokenModifiers[TokenModifier.declaration] = 'declaration';
tokenModifiers[TokenModifier.readonly] = 'readonly';
tokenModifiers[TokenModifier.static] = 'static';
tokenModifiers[TokenModifier.local] = 'local';
tokenModifiers[TokenModifier.defaultLibrary] = 'defaultLibrary';

// make sure token types and modifiers are complete
if (tokenTypes.filter(t => !!t).length !== TokenType._) {
	console.warn('typescript-vscode-sh-plugin has added new tokens types.');
}
if (tokenModifiers.filter(t => !!t).length !== TokenModifier._) {
	console.warn('typescript-vscode-sh-plugin has added new tokens modifiers.');
}

// mapping for the original ExperimentalProtocol.ClassificationType from TypeScript (only used when plugin is not available)
const tokenTypeMap: number[] = [];
tokenTypeMap[ExperimentalProtocol.ClassificationType.className] = TokenType.class;
tokenTypeMap[ExperimentalProtocol.ClassificationType.enumName] = TokenType.enum;
tokenTypeMap[ExperimentalProtocol.ClassificationType.interfaceName] = TokenType.interface;
tokenTypeMap[ExperimentalProtocol.ClassificationType.moduleName] = TokenType.namespace;
tokenTypeMap[ExperimentalProtocol.ClassificationType.typeParameterName] = TokenType.typeParameter;
tokenTypeMap[ExperimentalProtocol.ClassificationType.typeAliasName] = TokenType.type;
tokenTypeMap[ExperimentalProtocol.ClassificationType.parameterName] = TokenType.parameter;


namespace ExperimentalProtocol {

	export const enum EndOfLineState {
		None,
		InMultiLineCommentTrivia,
		InSingleQuoteStringLiteral,
		InDoubleQuoteStringLiteral,
		InTemplateHeadOrNoSubstitutionTemplate,
		InTemplateMiddleOrTail,
		InTemplateSubstitutionPosition,
	}

	export const enum ClassificationType {
		comment = 1,
		identifier = 2,
		keyword = 3,
		numericLiteral = 4,
		operator = 5,
		stringLiteral = 6,
		regularExpressionLiteral = 7,
		whiteSpace = 8,
		text = 9,
		punctuation = 10,
		className = 11,
		enumName = 12,
		interfaceName = 13,
		moduleName = 14,
		typeParameterName = 15,
		typeAliasName = 16,
		parameterName = 17,
		docCommentTagName = 18,
		jsxOpenTagName = 19,
		jsxCloseTagName = 20,
		jsxSelfClosingTagName = 21,
		jsxAttribute = 22,
		jsxText = 23,
		jsxAttributeStringLiteralValue = 24,
		bigintLiteral = 25,
	}
}
