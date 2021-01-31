import type { TsApiRegisterOptions } from '../types';
import { CancellationToken, Range, ResultProgressReporter, SemanticTokensBuilder, SemanticTokensLegend, SemanticTokensPartialResult } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import { MapedMode } from '../utils/sourceMaps';
import { hyphenate } from '@vue/shared';
import * as languageServices from '../utils/languageServices';
import * as html from 'vscode-html-languageservice';
import * as ts2 from '@volar/vscode-typescript-languageservice';

type TokenData = [number, number, number, number, number | undefined];

const tsLegend = ts2.getSemanticTokenLegend();
const tokenTypesLegend = [
	...tsLegend.types,
	'componentTag',
	'refLabel',
	'refVariable',
	'refVariableRaw',
];
const tokenTypes = new Map(tokenTypesLegend.map((t, i) => [t, i]));

export const semanticTokenLegend: SemanticTokensLegend = {
	tokenTypes: tokenTypesLegend,
	tokenModifiers: tsLegend.modifiers,
};

export function register({ sourceFiles, tsLanguageService }: TsApiRegisterOptions) {
	return (document: TextDocument, range?: Range, cancle?: CancellationToken, resultProgress?: ResultProgressReporter<SemanticTokensPartialResult>) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const offsetRange = range ? {
			start: document.offsetAt(range.start),
			end: document.offsetAt(range.end),
		} : undefined;
		const templateScriptData = sourceFile.getTemplateScriptData();
		const components = new Set([
			...templateScriptData.components,
			...templateScriptData.components.map(hyphenate),
			...templateScriptData.context,
			...templateScriptData.context.map(hyphenate),
		]);

		let tokens: TokenData[] = [];

		if (cancle?.isCancellationRequested) return;
		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult.length) {
			tokens = tokens.concat(htmlResult);
			resultProgress?.report(buildTokens(tokens));
		}

		if (cancle?.isCancellationRequested) return;
		const pugResult = getPugResult(sourceFile);
		if (pugResult.length) {
			tokens = tokens.concat(pugResult);
			resultProgress?.report(buildTokens(tokens));
		}

		if (cancle?.isCancellationRequested) return;
		const scriptSetupResult = getScriptSetupResult(sourceFile);
		if (scriptSetupResult.length) {
			tokens = tokens.concat(scriptSetupResult);
			resultProgress?.report(buildTokens(tokens));
		}

		if (cancle?.isCancellationRequested) return;
		let tsResult = getTsResult(sourceFile);
		tsResult = tsResult.filter(tsToken => {
			for (const setupToken of scriptSetupResult) {
				if (setupToken[0] === tsToken[0]
					&& setupToken[1] >= tsToken[1]
					&& setupToken[2] <= tsToken[2]) {
					return false;
				}
			}
			return true;
		});
		if (tsResult.length) {
			tokens = tokens.concat(tsResult);
		}

		return buildTokens(tokens);

		function buildTokens(tokens: TokenData[]) {
			const builder = new SemanticTokensBuilder();
			for (const token of tokens.sort((a, b) => a[0] - b[0] === 0 ? a[1] - b[1] : a[0] - b[0])) {
				builder.push(token[0], token[1], token[2], token[3], token[4] ?? 0);
			}

			return builder.build();
		}
		function getScriptSetupResult(sourceFile: SourceFile) {
			const result: TokenData[] = [];
			const scriptSetupGen = sourceFile.getScriptSetupData();
			const scriptSetup = sourceFile.getDescriptor().scriptSetup;
			if (scriptSetupGen && scriptSetup) {
				const genData = scriptSetupGen;
				for (const label of genData.labels) {
					const labelPos = document.positionAt(scriptSetup.loc.start + label.label.start);
					result.push([labelPos.line, labelPos.character, label.label.end - label.label.start + 1, tokenTypes.get('refLabel') ?? -1, undefined]);
					// for (const binary of label.binarys) {
					// 	for (const _var of binary.vars) {
					// 		const varPos = document.positionAt(scriptSetup.loc.start + _var.start);
					// 		result.push([varPos.line, varPos.character, _var.end - _var.start, tokenTypes.get('refVariable') ?? -1, undefined]);
					// 		for (const reference of _var.references) {
					// 			const referencePos = document.positionAt(scriptSetup.loc.start + reference.start);
					// 			result.push([referencePos.line, referencePos.character, reference.end - reference.start, tokenTypes.get('refVariable') ?? -1, undefined]);
					// 		}
					// 	}
					// }
				}
			}
			return result;
		}
		function getTsResult(sourceFile: SourceFile) {
			const result: TokenData[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const maped of sourceMap) {
					if (!maped.data.capabilities.semanticTokens)
						continue;
					if (offsetRange && maped.sourceRange.end < offsetRange.start)
						continue;
					if (offsetRange && maped.sourceRange.start > offsetRange.end)
						continue;
					const tsRange = {
						start: sourceMap.targetDocument.positionAt(maped.targetRange.start),
						end: sourceMap.targetDocument.positionAt(maped.targetRange.end),
					};
					const tokens = tsLanguageService.getDocumentSemanticTokens(sourceMap.targetDocument.uri, tsRange, cancle);
					if (!tokens)
						continue;
					for (const token of tokens) {
						const tsStart = sourceMap.targetDocument.offsetAt({ line: token[0], character: token[1] });
						const tsEnd = sourceMap.targetDocument.offsetAt({ line: token[0], character: token[1] + token[2] });
						const vueRange = sourceMap.targetToSource2({ start: tsStart, end: tsEnd });
						if (!vueRange?.data.capabilities.semanticTokens)
							continue;
						const vuePos = document.positionAt(vueRange.range.start);
						result.push([vuePos.line, vuePos.character, vueRange.range.end - vueRange.range.start, token[3], token[4]]);
					}
				}
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: TokenData[] = [];

			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				for (const maped of sourceMap) {
					if (maped.mode !== MapedMode.Offset)
						continue;
					if (offsetRange && maped.sourceRange.end < offsetRange.start)
						continue;
					if (offsetRange && maped.sourceRange.start > offsetRange.end)
						continue;
					const docText = sourceMap.targetDocument.getText();
					const scanner = languageServices.html.createScanner(docText, maped.targetRange.start);
					let token = scanner.scan();
					while (token !== html.TokenType.EOS && scanner.getTokenEnd() <= maped.targetRange.end) {
						const tokenOffset = scanner.getTokenOffset();
						const tokenLength = scanner.getTokenLength();
						const tokenText = docText.substr(tokenOffset, tokenLength);
						const vueOffset = tokenOffset - maped.targetRange.start + maped.sourceRange.start;
						if (isComponentToken(token, tokenText)) {
							const vuePos = sourceMap.sourceDocument.positionAt(vueOffset);
							result.push([vuePos.line, vuePos.character, tokenLength, tokenTypes.get('componentTag') ?? -1, undefined]);
						}
						token = scanner.scan();
					}
				}
			}

			return result;
		}
		function getPugResult(sourceFile: SourceFile) {
			const result: TokenData[] = [];

			for (const sourceMap of sourceFile.getPugSourceMaps()) {
				if (sourceMap.html === undefined)
					continue;
				for (const maped of sourceMap) {
					if (maped.mode !== MapedMode.Offset)
						continue;
					if (offsetRange && maped.sourceRange.end < offsetRange.start)
						continue;
					if (offsetRange && maped.sourceRange.start > offsetRange.end)
						continue;
					const docText = sourceMap.html;
					const scanner = languageServices.html.createScanner(docText, 0);
					let token = scanner.scan();
					while (token !== html.TokenType.EOS) {
						const htmlOffset = scanner.getTokenOffset();
						const tokenLength = scanner.getTokenLength();
						const tokenText = docText.substr(htmlOffset, tokenLength);
						if (isComponentToken(token, tokenText)) {
							const vuePos = getTokenPosition(htmlOffset, tokenText);
							if (vuePos) result.push([vuePos.line, vuePos.character, tokenLength, tokenTypes.get('componentTag') ?? -1, undefined]);
						}
						token = scanner.scan();
					}

					function getTokenPosition(htmlOffset: number, tokenText: string) {
						const tokenOffset = sourceMap.mapper?.(htmlOffset, htmlOffset + tokenText.length);
						if (tokenOffset !== undefined) {
							const vueOffset = tokenOffset - maped.targetRange.start + maped.sourceRange.start;
							const vuePos = document.positionAt(vueOffset);
							return vuePos;
						}
					}
				}
			}

			return result;
		}
		function isComponentToken(token: html.TokenType, tokenText: string) {
			if (token === html.TokenType.StartTag || token === html.TokenType.EndTag) {
				if (components.has(tokenText)) {
					return true;
				}
			}
			return false;
		}
	}
}
