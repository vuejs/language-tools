import {
	TextDocument,
	Range,
} from 'vscode-languageserver';
import { SemanticTokenTypes, SemanticTokenModifiers } from 'vscode-languageserver-protocol/lib/protocol.sematicTokens.proposed';
import { SourceFile } from '../sourceFiles';
import * as globalServices from '../globalServices';
import * as html from 'vscode-html-languageservice';
import { MapedMode } from '../utils/sourceMaps';
import { hyphenate } from '@vue/shared';
import * as ts2 from '@volar/vscode-typescript-languageservice';

type TokenData = [number, number, number, number, number | undefined];

const tsLegend = ts2.getSemanticTokenLegend();
const tokenTypesLegend = [
	...tsLegend.types,
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
	modifiers: tsLegend.modifiers,
};

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return async (document: TextDocument, range: Range) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const offsetRange = {
			start: document.offsetAt(range.start),
			end: document.offsetAt(range.end),
		};

		// TODO: inconsistent with typescript-language-features
		// const tsResult = await getTsResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);

		return [
			// ...tsResult,
			...htmlResult,
		];

		async function getTsResult(sourceFile: SourceFile) {
			const result: TokenData[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const maped of sourceMap) {
					if (!maped.data.capabilities.semanticTokens) continue;
					if (maped.vueRange.start < offsetRange.start) continue;
					if (maped.vueRange.end > offsetRange.end) continue;
					const tsRange = {
						start: sourceMap.virtualDocument.positionAt(maped.virtualRange.start),
						end: sourceMap.virtualDocument.positionAt(maped.virtualRange.end),
					};
					const tokens = await tsLanguageService.getDocumentSemanticTokens(sourceMap.virtualDocument, tsRange);
					if (!tokens) continue;
					for (const token of tokens) {
						const tokenOffset = sourceMap.virtualDocument.offsetAt(token.start);
						const vueOffset = tokenOffset - maped.virtualRange.start + maped.vueRange.start;
						const vuePos = document.positionAt(vueOffset);
						result.push([vuePos.line, vuePos.character, token.length, token.typeIdx, token.modifierSet]);
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
