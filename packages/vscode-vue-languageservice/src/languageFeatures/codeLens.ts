import {
	CodeLens,
	Range,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { Commands } from '../commands';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const htmlResult = getHtmlResult(sourceFile);
		const pugResult = getPugResult(sourceFile);

		return [
			...htmlResult,
			...pugResult,
		];

		function getHtmlResult(sourceFile: SourceFile) {
			const result: CodeLens[] = [];
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
			return result;
		}
		function getPugResult(sourceFile: SourceFile) {
			const result: CodeLens[] = [];
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
			return result;
		}
		function getPugHtmlConvertCodeLens(current: 'html' | 'pug', range: Range) {
			const result: CodeLens[] = [];
			result.push({
				range,
				command: {
					title: 'html' + (current === 'html' ? ' (current)' : ''),
					command: Commands.PUG_TO_HTML,
					arguments: [document.uri],
				},
			});
			result.push({
				range,
				command: {
					title: 'pug' + (current === 'pug' ? ' (current)' : ''),
					command: Commands.HTML_TO_PUG,
					arguments: [document.uri],
				},
			});
			return result;
		}
	}
}
