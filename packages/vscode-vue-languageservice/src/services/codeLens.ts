import type * as vscode from 'vscode-languageserver';
import { Commands } from '../commands';
import type { SourceFile } from '../sourceFile';
import type { ApiLanguageServiceContext } from '../types';

type CodeLensOptions = {
	references: boolean,
	pugTool: boolean,
	scriptSetupTool: boolean,
};

export interface TsCodeLensData {
	lsType: 'template' | 'script',
	uri: string,
	offset: number,
	tsUri: string,
	tsOffset: number,
}

export function register({ sourceFiles }: ApiLanguageServiceContext) {
	return (uri: string, options: CodeLensOptions = {
		references: true,
		pugTool: true,
		scriptSetupTool: true,
	}) => {

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return;

		const document = sourceFile.getTextDocument();
		let result: vscode.CodeLens[] = [];

		if (options.references) {
			result = result.concat(getTsResult(sourceFile));
		}
		if (options.pugTool) {
			result = result.concat(getHtmlResult(sourceFile));
			result = result.concat(getPugResult(sourceFile));
		}
		if (options.scriptSetupTool) {
			result = result.concat(getScriptSetupConvertConvert(sourceFile));
			result = result.concat(getRefSugarConvert(sourceFile));
		}

		return result;

		function getTsResult(sourceFile: SourceFile) {
			const result: vscode.CodeLens[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const maped of sourceMap) {
					if (!maped.data.capabilities.referencesCodeLens) continue;
					const data: TsCodeLensData = {
						lsType: sourceMap.lsType,
						uri: uri,
						offset: maped.sourceRange.start,
						tsUri: sourceMap.mappedDocument.uri,
						tsOffset: maped.mappedRange.start,
					};
					result.push({
						range: {
							start: document.positionAt(maped.sourceRange.start),
							end: document.positionAt(maped.sourceRange.end),
						},
						data,
					});
				}
			}
			return result;
		}
		function getScriptSetupConvertConvert(sourceFile: SourceFile) {

			const ranges = sourceFile.getSfcRefSugarRanges();
			if (ranges?.refs.length)
				return [];

			const result: vscode.CodeLens[] = [];
			const descriptor = sourceFile.getDescriptor();
			if (descriptor.scriptSetup) {
				result.push({
					range: {
						start: document.positionAt(descriptor.scriptSetup.startTagEnd),
						end: document.positionAt(descriptor.scriptSetup.startTagEnd + descriptor.scriptSetup.content.length),
					},
					command: {
						title: 'setup sugar ☑',
						command: Commands.UNUSE_SETUP_SUGAR,
						arguments: [uri],
					},
				});
			}
			else if (descriptor.script) {
				result.push({
					range: {
						start: document.positionAt(descriptor.script.startTagEnd),
						end: document.positionAt(descriptor.script.startTagEnd + descriptor.script.content.length),
					},
					command: {
						title: 'setup sugar ☐',
						command: Commands.USE_SETUP_SUGAR,
						arguments: [uri],
					},
				});
			}
			return result;
		}
		function getRefSugarConvert(sourceFile: SourceFile) {
			const result: vscode.CodeLens[] = [];
			const descriptor = sourceFile.getDescriptor();
			const ranges = sourceFile.getSfcRefSugarRanges();
			if (descriptor.scriptSetup && ranges) {
				result.push({
					range: {
						start: document.positionAt(descriptor.scriptSetup.startTagEnd),
						end: document.positionAt(descriptor.scriptSetup.startTagEnd + descriptor.scriptSetup.content.length),
					},
					command: {
						title: 'ref sugar (take 2) ' + (ranges.refs.length ? '☑' : '☐'),
						command: ranges.refs.length ? Commands.UNUSE_REF_SUGAR : Commands.USE_REF_SUGAR,
						arguments: [uri],
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
		function getPugHtmlConvertCodeLens(current: 'html' | 'pug', range: vscode.Range) {
			const result: vscode.CodeLens[] = [];
			result.push({
				range,
				command: {
					title: 'pug ' + (current === 'pug' ? '☑' : '☐'),
					command: current === 'pug' ? Commands.PUG_TO_HTML : Commands.HTML_TO_PUG,
					arguments: [uri],
				},
			});
			return result;
		}
	}
}
