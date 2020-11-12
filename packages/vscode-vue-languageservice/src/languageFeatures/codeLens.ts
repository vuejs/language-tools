import {
	CodeLens,
	Range,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { Commands } from '../commands';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { rfc } from '../virtuals/scriptSetup';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const scriptSetupResult = getScriptSetupResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const pugResult = getPugResult(sourceFile);

		return [
			...scriptSetupResult,
			...htmlResult,
			...pugResult,
		];

		function getScriptSetupResult(sourceFile: SourceFile) {
			const result: CodeLens[] = [];
			const descriptor = sourceFile.getDescriptor();
			// const data = sourceFile.getScriptSetupData();
			// if (descriptor.scriptSetup && data) {
			// 	result.push({
			// 		range: {
			// 			start: document.positionAt(descriptor.scriptSetup.loc.start),
			// 			end: document.positionAt(descriptor.scriptSetup.loc.end),
			// 		},
			// 		command: {
			// 			title: 'ref sugar ' + (data.data.labels.length ? '☑' : '☐'),
			// 			command: data.data.labels.length ? Commands.UNUSE_REF_SUGAR : Commands.USE_REF_SUGAR,
			// 			arguments: [document.uri],
			// 		},
			// 	});
			// }
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
