import { hyphenate, isHTMLTag } from '@vue/shared';
import * as vscode from 'vscode-languageserver-protocol';
import type { SourceFile } from '../sourceFile';
import type { ApiLanguageServiceContext } from '../types';
import * as ts2 from 'vscode-typescript-languageservice'; // TODO: remove it

type SemanticToken = [number, number, number, number, number | undefined];

export function getSemanticTokenLegend() {

	const tsLegend = ts2.getSemanticTokenLegend();
	const tokenTypesLegend = [
		...tsLegend.types,
		'componentTag',
		'operator', // namespaced component accessor: '.'
	];
	const semanticTokenLegend: vscode.SemanticTokensLegend = {
		tokenTypes: tokenTypesLegend,
		tokenModifiers: tsLegend.modifiers,
	};

	return semanticTokenLegend;
}

export function register({ sourceFiles, getTsLs, htmlLs, pugLs, scriptTsLs, modules: { html }, getPugDocument }: ApiLanguageServiceContext, updateTemplateScripts: () => void) {

	const semanticTokensLegend = getSemanticTokenLegend();
	const tokenTypes = new Map(semanticTokensLegend.tokenTypes.map((t, i) => [t, i]));

	return (uri: string, range?: vscode.Range, cancle?: vscode.CancellationToken, reportProgress?: (tokens: SemanticToken[]) => void): SemanticToken[] | undefined => {

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) {
			// take over mode
			const tokens = scriptTsLs.getDocumentSemanticTokens(uri, range, cancle);
			return tokens;
		}

		const document = sourceFile.getTextDocument();
		const offsetRange = range ?
			{
				start: document.offsetAt(range.start),
				end: document.offsetAt(range.end),
			} : {
				start: 0,
				end: document.getText().length,
			};

		let tokens: SemanticToken[] = [];

		if (cancle?.isCancellationRequested) return;
		const scriptResult = getTsResult(sourceFile, 'script');
		if (!cancle?.isCancellationRequested && scriptResult.length) {
			tokens = tokens.concat(scriptResult);
			reportProgress?.(tokens);
		}

		if (sourceFile.getHtmlSourceMaps().length) {
			updateTemplateScripts()
		}

		if (cancle?.isCancellationRequested) return;
		const templateResult = getTsResult(sourceFile, 'template');
		if (!cancle?.isCancellationRequested && templateResult.length) {
			tokens = tokens.concat(templateResult);
			reportProgress?.(tokens);
		}

		if (cancle?.isCancellationRequested) return;
		const htmlResult = getHtmlResult(sourceFile);
		if (!cancle?.isCancellationRequested && htmlResult.length) {
			tokens = tokens.concat(htmlResult);
			reportProgress?.(tokens);
		}

		return tokens;

		function getTsResult(sourceFile: SourceFile, lsType: 'script' | 'template') {
			const result: SemanticToken[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {

				if (sourceMap.lsType !== lsType)
					continue;

				const tsLs = getTsLs(sourceMap.lsType);

				for (const maped of sourceMap.mappings) {
					if (
						maped.data.capabilities.semanticTokens
						&& maped.sourceRange.end > offsetRange.start
						&& maped.sourceRange.start < offsetRange.end
					) {
						if (cancle?.isCancellationRequested)
							return result;
						const tsRange = {
							start: sourceMap.mappedDocument.positionAt(maped.mappedRange.start),
							end: sourceMap.mappedDocument.positionAt(maped.mappedRange.end),
						};
						const tokens = tsLs.getDocumentSemanticTokens(sourceMap.mappedDocument.uri, tsRange, cancle);
						if (!tokens)
							continue;
						for (const token of tokens) {
							const tsStart = sourceMap.mappedDocument.offsetAt({ line: token[0], character: token[1] });
							const tsEnd = sourceMap.mappedDocument.offsetAt({ line: token[0], character: token[1] + token[2] });
							const vueRange = sourceMap.getSourceRange(tsStart, tsEnd, data => !!data.capabilities.semanticTokens)?.[0];
							if (!vueRange)
								continue;
							const vuePos = document.positionAt(vueRange.start);
							result.push([vuePos.line, vuePos.character, vueRange.end - vueRange.start, token[3], token[4]]);
						}
					}
				}
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {

			const result: SemanticToken[] = [];
			const templateScriptData = sourceFile.getTemplateScriptData();
			const components = new Set([
				...templateScriptData.components,
				...templateScriptData.components.map(hyphenate).filter(name => !isHTMLTag(name)),
			]);

			for (const sourceMap of [...sourceFile.getHtmlSourceMaps(), ...sourceFile.getPugSourceMaps()]) {

				let htmlStart = sourceMap.getMappedRange(offsetRange.start)?.[0].start;
				if (htmlStart === undefined) {
					for (const mapping of sourceMap.mappings) {
						if (mapping.sourceRange.end >= offsetRange.start) {
							if (htmlStart === undefined || mapping.mappedRange.start < htmlStart) {
								htmlStart = mapping.mappedRange.start;
							}
						}
					}
				}
				if (htmlStart === undefined)
					continue;

				const docText = sourceMap.mappedDocument.getText();
				const pugDocument = getPugDocument(sourceMap.mappedDocument);
				const scanner = sourceMap.language === 'html'
					? htmlLs.createScanner(docText)
					: (pugDocument ? pugLs.createScanner(pugDocument) : undefined)
				if (!scanner) continue;

				let token = scanner.scan();
				while (token !== html.TokenType.EOS) {
					const tokenOffset = scanner.getTokenOffset();
					if (tokenOffset >= htmlStart && (token === html.TokenType.StartTag || token === html.TokenType.EndTag)) {
						const tokenText = scanner.getTokenText();
						if (components.has(tokenText) || tokenText.indexOf('.') >= 0) {
							const tokenLength = scanner.getTokenLength();
							const vueRange = sourceMap.getSourceRange(tokenOffset)?.[0];
							if (vueRange) {
								const vueOffset = vueRange.start;
								if (vueOffset > offsetRange.end) break; // TODO: fix source map perf and break in while condition
								const vuePos = sourceMap.sourceDocument.positionAt(vueOffset);

								if (components.has(tokenText)) {
									result.push([vuePos.line, vuePos.character, tokenLength, tokenTypes.get('componentTag') ?? -1, undefined]);
								}
								else if (tokenText.indexOf('.') >= 0) {
									for (let i = 0; i < tokenText.length; i++) {
										if (tokenText[i] === '.') {
											result.push([vuePos.line, vuePos.character + i, 1, tokenTypes.get('operator') ?? -1, undefined]);
										}
									}
								}
							}
						}
					}
					token = scanner.scan();
				}
			}

			return result;
		}
	}
}
