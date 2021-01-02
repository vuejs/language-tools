import {
	CodeLens,
	Range,
} from 'vscode-languageserver-types';
import { SourceFile } from '../sourceFiles';
import { Commands } from '../commands';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { TsSourceMap } from '../utils/sourceMaps';

export function register(sourceFiles: Map<string, SourceFile>, getGlobalTsSourceMaps: () => Map<string, { sourceMap: TsSourceMap }>) {
	return (document: TextDocument) => {

		const globalTsSourceMaps = getGlobalTsSourceMaps?.();
		const globalTsSourceMap = globalTsSourceMaps?.get(document.uri);
		
		if (globalTsSourceMap) {
			const result: CodeLens[] = [];
			for (const maped of globalTsSourceMap.sourceMap) {
				if (!maped.data.capabilities.referencesCodeLens) continue;
				const codeLens: CodeLens = {
					range: {
						start: document.positionAt(maped.sourceRange.start),
						end: document.positionAt(maped.sourceRange.end),
					},
					data: {
						uri: document.uri,
						tsUri: globalTsSourceMap.sourceMap.targetDocument.uri,
						tsOffset: maped.targetRange.start,
					},
				};
				result.push(codeLens);
			}
			return result;
		}

		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const scriptSetupResult = getScriptSetupResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const pugResult = getPugResult(sourceFile);
		const tsResult = getTsResult(sourceFile);

		return [
			...scriptSetupResult,
			...htmlResult,
			...pugResult,
			...tsResult,
		];

		function getTsResult(sourceFile: SourceFile) {
			const result: CodeLens[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const maped of sourceMap) {
					if (!maped.data.capabilities.referencesCodeLens) continue;
					const codeLens: CodeLens = {
						range: {
							start: document.positionAt(maped.sourceRange.start),
							end: document.positionAt(maped.sourceRange.end),
						},
						data: {
							uri: document.uri,
							tsUri: sourceMap.targetDocument.uri,
							tsOffset: maped.targetRange.start,
						},
					};
					result.push(codeLens);
				}
			}
			return result;
		}
		function getScriptSetupResult(sourceFile: SourceFile) {
			const result: CodeLens[] = [];
			const descriptor = sourceFile.getDescriptor();
			const data = sourceFile.getScriptSetupData();
			if (descriptor.scriptSetup && data) {
				result.push({
					range: {
						start: document.positionAt(descriptor.scriptSetup.loc.start),
						end: document.positionAt(descriptor.scriptSetup.loc.end),
					},
					command: {
						title: 'ref sugar ' + (data.data.labels.length ? '☑' : '☐'),
						command: Commands.SWITCH_REF_SUGAR,
						arguments: [document.uri],
					},
				});
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const sourceMaps = sourceFile.getHtmlSourceMaps();
			for (const sourceMap of sourceMaps) {
				for (const maped of sourceMap) {
					return getPugHtmlConvertCodeLens(
						'html',
						{
							start: sourceMap.sourceDocument.positionAt(maped.sourceRange.start),
							end: sourceMap.sourceDocument.positionAt(maped.sourceRange.start),
						},
					);
				}
			}
			return [];
		}
		function getPugResult(sourceFile: SourceFile) {
			const sourceMaps = sourceFile.getPugSourceMaps();
			for (const sourceMap of sourceMaps) {
				for (const maped of sourceMap) {
					return getPugHtmlConvertCodeLens(
						'pug',
						{
							start: sourceMap.sourceDocument.positionAt(maped.sourceRange.start),
							end: sourceMap.sourceDocument.positionAt(maped.sourceRange.start),
						},
					);
				}
			}
			return [];
		}
		function getPugHtmlConvertCodeLens(current: 'html' | 'pug', range: Range) {
			const result: CodeLens[] = [];
			result.push({
				range,
				command: {
					title: 'html ' + (current === 'html' ? '☑' : '☐'),
					command: current === 'html' ? '' : Commands.PUG_TO_HTML,
					arguments: [document.uri],
				},
			});
			result.push({
				range,
				command: {
					title: 'pug ' + (current === 'pug' ? '☑' : '☐'),
					command: current === 'pug' ? '' : Commands.HTML_TO_PUG,
					arguments: [document.uri],
				},
			});
			return result;
		}
	}
}
