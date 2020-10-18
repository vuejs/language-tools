import {
	TextDocument,
	Range,
	CancellationToken,
} from 'vscode-languageserver';
import { SemanticTokenTypes, SemanticTokenModifiers } from 'vscode-languageserver-protocol/lib/protocol.sematicTokens.proposed';
import { SourceFile } from '../sourceFiles';
import * as globalServices from '../globalServices';
import * as html from 'vscode-html-languageservice';
import { MapedMode } from '../utils/sourceMaps';
import { hyphenate } from '@vue/shared';
import * as ts2 from '@volar/vscode-typescript-languageservice';
import { Position } from 'vscode-html-languageservice';

type TokenData = [number, number, number, number, number | undefined];

const tsLegend = ts2.getLegend();
const tokenTypesLegend = [
	...tsLegend.tokenTypes,
	SemanticTokenTypes.comment,
	SemanticTokenTypes.keyword,
	SemanticTokenTypes.string,
	SemanticTokenTypes.number,
	SemanticTokenTypes.regexp,
	SemanticTokenTypes.operator,
	SemanticTokenTypes.namespace,
	SemanticTokenTypes.type,
	SemanticTokenTypes.struct,
	SemanticTokenTypes.class,
	SemanticTokenTypes.interface,
	SemanticTokenTypes.enum,
	SemanticTokenTypes.typeParameter,
	SemanticTokenTypes.function,
	SemanticTokenTypes.member,
	SemanticTokenTypes.property,
	SemanticTokenTypes.macro,
	SemanticTokenTypes.variable,
	SemanticTokenTypes.parameter,
	SemanticTokenTypes.label,
];
const tokenTypes = new Map(tokenTypesLegend.map((t, i) => [t, i]));

export const semanticTokenLegend = {
	types: tokenTypesLegend,
	modifiers: tsLegend.tokenModifiers,
};

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return async (document: TextDocument, range: Range, token: CancellationToken) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const offsetRange = {
			start: document.offsetAt(range.start),
			end: document.offsetAt(range.end),
		};

		const tsResult = await getTsResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);

		return [...tsResult, ...htmlResult];

		async function getTsResult(sourceFile: SourceFile) {
			const result: TokenData[] = [];
			const tsSemanticTokensProvider = tsLanguageService.getDocumentSemanticTokensProvider();

			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const maped of sourceMap) {
					if (maped.mode !== MapedMode.Offset) continue;
					if (maped.vueRange.start < offsetRange.start) continue;
					if (maped.vueRange.end > offsetRange.end) continue;
					const tsRange = {
						start: sourceMap.virtualDocument.positionAt(maped.virtualRange.start),
						end: sourceMap.virtualDocument.positionAt(maped.virtualRange.end),
					};
					const tokens = await tsSemanticTokensProvider.provideDocumentRangeSemanticTokens(sourceMap.virtualDocument, tsRange, token);
					if (!tokens) continue;
					for (const token of tokens) {
						const [line, character] = token;
						const tokenPos = Position.create(line, character);
						const tokenOffset = sourceMap.virtualDocument.offsetAt(tokenPos);
						const vueOffset = tokenOffset - maped.virtualRange.start + maped.vueRange.start;
						const vuePos = document.positionAt(vueOffset);
						token[0] = vuePos.line;
						token[1] = vuePos.character;
						result.push(token);
					}
				}
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: TokenData[] = [];
			const templateScriptData = sourceFile.getTemplateScriptData();
			const components = new Set([...templateScriptData.components, ...templateScriptData.components.map(hyphenate)]);

			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				for (const maped of sourceMap) {
					if (maped.mode !== MapedMode.Offset) continue;
					if (maped.vueRange.start < offsetRange.start) continue;
					if (maped.vueRange.end > offsetRange.end) continue;
					const docText = sourceMap.virtualDocument.getText();
					const scanner = globalServices.html.createScanner(docText, maped.virtualRange.start);
					let token = scanner.scan();
					while (token !== html.TokenType.EOS && scanner.getTokenEnd() <= maped.virtualRange.end) {
						const tokenOffset = scanner.getTokenOffset();
						const tokenLength = scanner.getTokenLength();
						const vueOffset = tokenOffset - maped.virtualRange.start + maped.vueRange.start;
						const vuePos = sourceMap.vueDocument.positionAt(vueOffset);
						if (token === html.TokenType.AttributeName) {
							const tokenText = docText.substr(tokenOffset, tokenLength);
							if (['v-if', 'v-else-if', 'v-else', 'v-for'].includes(tokenText)) {
								result.push([vuePos.line, vuePos.character, tokenLength, tokenTypes.get(SemanticTokenTypes.keyword) ?? -1, undefined]);
							}
						}
						else if (token === html.TokenType.StartTag || token === html.TokenType.EndTag) {
							const tokenText = docText.substr(tokenOffset, tokenLength);
							if (components.has(tokenText)) {
								result.push([vuePos.line, vuePos.character, tokenLength, tokenTypes.get(SemanticTokenTypes.class) ?? -1, undefined]);
							}
						}
						token = scanner.scan();
					}
				}
			}
			return result;
		}
	}
}
