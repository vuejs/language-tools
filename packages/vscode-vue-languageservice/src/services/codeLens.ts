import {
	CodeLens,
	Range,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { Commands } from '../commands';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { rfc } from '../virtuals/script';
import * as resolve from './codeLensResolve';
import type * as ts2 from '@volar/vscode-typescript-languageservice';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	const doResolve = resolve.register(sourceFiles, tsLanguageService);
	return (document: TextDocument) => {
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
							tsDoc: sourceMap.targetDocument,
							tsPos: sourceMap.targetDocument.positionAt(maped.targetRange.start),
						},
					};
					doResolve(codeLens); // TODO
					result.push(codeLens);
				}
			}
			return result;
		}
		function getScriptSetupResult(sourceFile: SourceFile) {
			const result: CodeLens[] = [];
			const descriptor = sourceFile.getDescriptor();
			if (descriptor.scriptSetup) {
				result.push({
					range: {
						start: document.positionAt(descriptor.scriptSetup.loc.start),
						end: document.positionAt(descriptor.scriptSetup.loc.end),
					},
					command: {
						title: 'RFC: ' + rfc,
						command: '',
					},
				})
			}
			const data = sourceFile.getScriptSetupData();
			if (descriptor.scriptSetup && rfc === '#222' && data) {
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
