import { hyphenate, isHTMLTag } from '@vue/shared';
import * as vscode from 'vscode-languageserver';
import type { SourceFile } from '../sourceFile';
import type { ApiLanguageServiceContext } from '../types';
import * as ts2 from 'vscode-typescript-languageservice'; // TODO: remove it

type TokenData = [number, number, number, number, number | undefined];

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

export function register({ sourceFiles, getTsLs, htmlLs, pugLs, scriptTsLs, modules: { html } }: ApiLanguageServiceContext, updateTemplateScripts: () => void) {

	const semanticTokensLegend = getSemanticTokenLegend();
	const tokenTypes = new Map(semanticTokensLegend.tokenTypes.map((t, i) => [t, i]));

	return (uri: string, range?: vscode.Range, cancle?: vscode.CancellationToken, resultProgress?: vscode.ResultProgressReporter<vscode.SemanticTokensPartialResult>) => {

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) {
			// take over mode
			const tokens = scriptTsLs.getDocumentSemanticTokens(uri, range, cancle);
			return buildTokens(tokens ?? []);
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

		let tokens: TokenData[] = [];

		if (cancle?.isCancellationRequested) return;
		const scriptResult = getTsResult(sourceFile, 'script');
		if (!cancle?.isCancellationRequested && scriptResult.length) {
			tokens = tokens.concat(scriptResult);
			resultProgress?.report(buildTokens(tokens));
		}

		if (sourceFile.getHtmlSourceMaps().length) {
			updateTemplateScripts()
		}

		if (cancle?.isCancellationRequested) return;
		const templateResult = getTsResult(sourceFile, 'template');
		if (!cancle?.isCancellationRequested && templateResult.length) {
			tokens = tokens.concat(templateResult);
			resultProgress?.report(buildTokens(tokens));
		}

		if (cancle?.isCancellationRequested) return;
		const htmlResult = getHtmlResult(sourceFile);
		if (!cancle?.isCancellationRequested && htmlResult.length) {
			tokens = tokens.concat(htmlResult);
			resultProgress?.report(buildTokens(tokens));
		}

		if (cancle?.isCancellationRequested) return;
		return buildTokens(tokens);

		function buildTokens(tokens: TokenData[]) {
			const builder = new vscode.SemanticTokensBuilder();
			for (const token of tokens.sort((a, b) => a[0] - b[0] === 0 ? a[1] - b[1] : a[0] - b[0])) {
				builder.push(token[0], token[1], token[2], token[3], token[4] ?? 0);
			}

			return builder.build();
		}
		function getTsResult(sourceFile: SourceFile, lsType: 'script' | 'template') {
			const result: TokenData[] = [];
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
			const result: TokenData[] = [];

			const templateScriptData = sourceFile.getTemplateScriptData();
			const components = new Set([
				...templateScriptData.components,
				...templateScriptData.components.map(hyphenate).filter(name => !isHTMLTag(name)),
			]);

			for (const sourceMap of [...sourceFile.getHtmlSourceMaps(), ...sourceFile.getPugSourceMaps()]) {

				const inSourceMap = [...sourceMap.mappings].some(mapping =>
					(mapping.sourceRange.start >= offsetRange.start && mapping.sourceRange.start <= offsetRange.end)
					|| (mapping.sourceRange.end >= offsetRange.start && mapping.sourceRange.end <= offsetRange.end)
				);
				if (!inSourceMap)
					continue;

				const htmlStart = sourceMap.getMappedRange(offsetRange.start)?.[0].start ?? 0;
				const docText = sourceMap.mappedDocument.getText();
				const scanner = sourceMap.language === 'html'
					? htmlLs.createScanner(docText, htmlStart)
					: pugLs.createScanner(sourceMap.pugDocument, htmlStart)
				if (!scanner) continue;

				let token = scanner.scan();
				while (token !== html.TokenType.EOS) {
					if (token === html.TokenType.StartTag || token === html.TokenType.EndTag) {
						const tokenText = scanner.getTokenText();
						if (components.has(tokenText) || tokenText.indexOf('.') >= 0) {
							const tokenOffset = scanner.getTokenOffset();
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
