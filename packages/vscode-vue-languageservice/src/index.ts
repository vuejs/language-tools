import {
	Range,
	CodeAction,
	CodeActionKind,
	TextDocument,
	TextEdit,
	Connection,
} from 'vscode-languageserver';
import { uriToFsPath, fsPathToUri } from '@volar/shared';
import { pugToHtml, htmlToPug } from '@volar/pug';
import { createSourceFile, SourceFile } from './sourceFiles';
import * as ts from 'typescript';
import * as ts2 from '@volar/vscode-typescript-languageservice';
import * as css from 'vscode-css-languageservice';
import * as html from 'vscode-html-languageservice';
import * as prettyhtml from '@starptech/prettyhtml';
import * as doComplete from './languageFeatures/completions';
import * as doCompletionResolve from './languageFeatures/completionResolve';
import * as doHover from './languageFeatures/hover';
import * as doValidation from './languageFeatures/diagnostics';
import * as doRangeFormatting from './languageFeatures/rangeFormatting';
import * as doFormatting from './languageFeatures/formatting';
import * as findDefinition from './languageFeatures/definitions';
import * as findReferences from './languageFeatures/references';
import * as findTypeDefinition from './languageFeatures/typeDefinitions';
import * as doRename from './languageFeatures/rename';
import * as findDocumentHighlights from './languageFeatures/documentHighlight';
import * as findDocumentSymbols from './languageFeatures/documentSymbol';
import * as findDocumentLinks from './languageFeatures/documentLink';
import * as findDocumentColors from './languageFeatures/documentColor';
import * as getSelectionRanges from './languageFeatures/selectionRanges';
import * as getSignatureHelp from './languageFeatures/signatureHelp';
import * as getColorPresentations from './languageFeatures/colorPresentations';

export enum Commands {
	HTML_TO_PUG_COMMAND = 'volar.html-to-pug',
	PUG_TO_HTML_COMMAND = 'volar.pug-to-html',
}
export interface LanguageServiceHost extends ts.LanguageServiceHost { }
export type LanguageService = ReturnType<typeof createLanguageService>;

export function createLanguageService(host: LanguageServiceHost) {

	let lastProjectVersion: string | undefined;
	let lastScriptVersions = new Map<string, string>();
	let tsProjectVersion = 0;
	const documents = new Map<string, TextDocument>();
	const sourceFiles = new Map<string, SourceFile>();

	const tsLanguageServiceHost = createTsLanguageServiceHost();
	const tsLanguageService = ts2.createLanguageService(tsLanguageServiceHost);
	const htmlLanguageService = html.getLanguageService();
	const cssLanguageService = css.getCSSLanguageService();
	const scssLanguageService = css.getSCSSLanguageService();

	return {
		getSourceFile: apiHook(getSourceFile),
		getAllSourceFiles: apiHook(getAllSourceFiles),
		doValidation: apiHook(doValidation.register(sourceFiles, () => tsLanguageServiceHost.getProjectVersion?.() ?? '-1')),
		doComplete: apiHook(doComplete.register(sourceFiles)),
		doCompletionResolve: apiHook(doCompletionResolve.register(sourceFiles)),
		doHover: apiHook(doHover.register(sourceFiles)),
		doRangeFormatting: apiHook(doRangeFormatting.register(sourceFiles)),
		doFormatting: apiHook(doFormatting.register(sourceFiles)),
		findDefinition: apiHook(findDefinition.register(sourceFiles)),
		findReferences: apiHook(findReferences.register(sourceFiles)),
		findTypeDefinition: apiHook(findTypeDefinition.register(sourceFiles)),
		doRename: apiHook(doRename.register(sourceFiles)),
		doCodeAction: apiHook(doCodeAction),
		doExecuteCommand: apiHook(doExecuteCommand),
		getSignatureHelp: apiHook(getSignatureHelp.register(sourceFiles)),
		getSelectionRanges: apiHook(getSelectionRanges.register(sourceFiles)),
		getColorPresentations: apiHook(getColorPresentations.register(sourceFiles)),
		findDocumentHighlights: apiHook(findDocumentHighlights.register(sourceFiles)),
		findDocumentSymbols: apiHook(findDocumentSymbols.register(sourceFiles)),
		findDocumentLinks: apiHook(findDocumentLinks.register(sourceFiles, host)),
		findDocumentColors: apiHook(findDocumentColors.register(sourceFiles)),
		dispose: tsLanguageService.dispose,
	};

	function apiHook<T extends Function>(api: T) {
		const handler = {
			apply: function (target: Function, thisArg: any, argumentsList: any[]) {
				update();
				return target.apply(thisArg, argumentsList);
			}
		};
		return new Proxy(api, handler) as T;
	}
	function update() {
		const currentVersion = host.getProjectVersion?.();
		if (currentVersion === undefined || currentVersion !== lastProjectVersion) {

			let tsProjectUpdated = false;
			lastProjectVersion = currentVersion;
			const oldFiles = new Set([...lastScriptVersions.keys()]);
			const newFiles = new Set(host.getScriptFileNames());
			const removes: string[] = [];
			const adds: string[] = [];
			const updates: string[] = [];

			for (const fileName of oldFiles) {
				if (!newFiles.has(fileName)) {
					if (fileName.endsWith('.vue')) {
						removes.push(fileName);
					}
					else {
						tsProjectUpdated = true;
					}
					lastScriptVersions.delete(fileName);
				}
			}
			for (const fileName of newFiles) {
				if (!oldFiles.has(fileName)) {
					if (fileName.endsWith('.vue')) {
						adds.push(fileName);
					}
					else {
						tsProjectUpdated = true;
					}
					lastScriptVersions.set(fileName, host.getScriptVersion(fileName));
				}
			}
			for (const fileName of oldFiles) {
				if (newFiles.has(fileName)) {
					const oldVersion = lastScriptVersions.get(fileName);
					const newVersion = host.getScriptVersion(fileName);
					if (oldVersion !== newVersion) {
						if (fileName.endsWith('.vue')) {
							updates.push(fileName);
						}
						else {
							tsProjectUpdated = true;
						}
						lastScriptVersions.set(fileName, newVersion);
					}
				}
			}

			if (tsProjectUpdated) {
				tsProjectVersion++;
				updates.length = 0;
				for (const fileName of oldFiles) {
					if (newFiles.has(fileName)) {
						if (fileName.endsWith('.vue')) {
							updates.push(fileName);
						}
					}
				}
			}

			unsetSourceFiles(removes.map(fsPathToUri));
			updateSourceFiles(adds.concat(updates).map(fsPathToUri), tsProjectUpdated)
		}
	}
	function createTsLanguageServiceHost() {
		const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
		const tsHost: ts2.LanguageServiceHost = {
			...host,
			getProjectVersion: () => tsProjectVersion.toString(),
			getScriptFileNames,
			getScriptVersion,
			getScriptSnapshot,
		};

		return tsHost;

		function getScriptFileNames() {
			const tsFileNames: string[] = [];
			for (const fileName of host.getScriptFileNames()) {
				const uri = fsPathToUri(fileName);
				const sourceFile = sourceFiles.get(uri);
				if (sourceFile) {
					for (const uri of sourceFile.getTsUris()) {
						tsFileNames.push(uriToFsPath(uri));
					}
				}
				else {
					tsFileNames.push(fileName);
				}
			}
			return tsFileNames;
		}
		function getScriptVersion(fileName: string) {
			const uri = fsPathToUri(fileName);
			for (const [_, sourceFile] of sourceFiles) {
				const doc = sourceFile.getTsDocuments().get(uri);
				if (doc) {
					return doc.version.toString();
				}
			}
			return host.getScriptVersion(fileName);
		}
		function getScriptSnapshot(fileName: string) {
			const version = getScriptVersion(fileName);
			const cache = scriptSnapshots.get(fileName);
			if (cache && cache[0] === version) {
				return cache[1];
			}
			const uri = fsPathToUri(fileName);
			for (const [_, sourceFile] of sourceFiles) {
				const doc = sourceFile.getTsDocuments().get(uri);
				if (doc) {
					const text = doc.getText();
					const snapshot = ts.ScriptSnapshot.fromString(text);
					scriptSnapshots.set(fileName, [version, snapshot]);
					return snapshot;
				}
			}
			return host.getScriptSnapshot(fileName);
		}
	}
	function doCodeAction(document: TextDocument, range: Range): CodeAction[] {
		if (range.start.line != range.end.line) return [];

		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return [];

		const desc = sourceFile.getDescriptor();
		if (!desc.template) return [];

		const handlerLine = range.start.line;
		const templateStartLine = document.positionAt(desc.template.loc.start.offset).line;
		if (handlerLine === templateStartLine) { // first line of <template>
			const lang = desc.template.lang;

			const htmlToPug: CodeAction = { title: `Convert to Pug`, kind: CodeActionKind.RefactorRewrite };
			const pugToHtml: CodeAction = { title: `Convert to HTML`, kind: CodeActionKind.RefactorRewrite };

			htmlToPug.command = {
				command: Commands.HTML_TO_PUG_COMMAND,
				title: 'Convert to Pug',
				arguments: [document.uri],
			};
			pugToHtml.command = {
				command: Commands.PUG_TO_HTML_COMMAND,
				title: 'Convert to HTML',
				arguments: [document.uri],
			};

			if (lang === 'pug') return [pugToHtml];
			if (lang === 'html') return [htmlToPug];
		}

		return [];
	}
	function doExecuteCommand(document: TextDocument, command: string, connection: Connection) {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const desc = sourceFile.getDescriptor();
		if (!desc.template) return;

		const lang = desc.template.lang;

		if (command === Commands.HTML_TO_PUG_COMMAND) {
			if (lang !== 'html') return;

			const pug = htmlToPug(desc.template.content, 2, false) + '\n';
			const newTemplate = `<template lang='pug'>` + pug;

			let start = desc.template.loc.start.offset - '<template>'.length;
			const end = desc.template.loc.end.offset;
			const startMatch = '<template';

			while (!document.getText(Range.create(
				document.positionAt(start),
				document.positionAt(start + startMatch.length),
			)).startsWith(startMatch)) {
				start--;
				if (start < 0) {
					throw 'Can't find start of tag <template>'
				}
			}

			const range = Range.create(
				document.positionAt(start),
				document.positionAt(end),
			);
			const textEdit = TextEdit.replace(range, newTemplate);
			connection.workspace.applyEdit({ changes: { [document.uri]: [textEdit] } });
		}
		if (command === Commands.PUG_TO_HTML_COMMAND) {
			if (lang !== 'pug') return;

			let html = pugToHtml(desc.template.content);
			html = prettyhtml(html).contents;
			const newTemplate = `<template>\n` + html;

			let start = desc.template.loc.start.offset - '<template>'.length;
			const end = desc.template.loc.end.offset;
			const startMatch = '<template';

			while (!document.getText(Range.create(
				document.positionAt(start),
				document.positionAt(start + startMatch.length),
			)).startsWith(startMatch)) {
				start--;
				if (start < 0) {
					throw 'Can't find start of tag <template>'
				}
			}

			const range = Range.create(
				document.positionAt(start),
				document.positionAt(end),
			);
			const textEdit = TextEdit.replace(range, newTemplate);
			connection.workspace.applyEdit({ changes: { [document.uri]: [textEdit] } });
		}
	}
	function getTextDocument(uri: string): TextDocument | undefined {
		const doc = tsLanguageService.getTextDocument(uri);
		if (doc) return doc;

		const fileName = uriToFsPath(uri);
		const version = Number(host.getScriptVersion(fileName));
		if (!documents.has(uri) || documents.get(uri)!.version !== version) {
			const scriptSnapshot = host.getScriptSnapshot(fileName);
			if (scriptSnapshot) {
				const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
				const document = TextDocument.create(uri, 'typescript', version, scriptText);
				documents.set(uri, document);
			}
		}
		return documents.get(uri);
	}
	function getSourceFile(uri: string) {
		return sourceFiles.get(uri);
	}
	function getAllSourceFiles() {
		return [...sourceFiles.values()];
	}
	function updateSourceFiles(uris: string[], tsFilesUpdated: boolean) {
		let vueScriptsUpdated = false;
		let vueTemplageScriptUpdated = false;

		for (const uri of uris) {
			const sourceFile = sourceFiles.get(uri);
			const doc = getTextDocument(uri);
			if (!doc) continue;
			if (!sourceFile) {
				sourceFiles.set(uri, createSourceFile(doc, {
					htmlLanguageService,
					cssLanguageService,
					scssLanguageService,
					tsLanguageService,
				}));
				vueScriptsUpdated = true;
			}
			else {
				const updates = sourceFile.update(doc);
				if (updates.scriptUpdated) {
					vueScriptsUpdated = true;
				}
				if (updates.templateScriptUpdated) {
					vueTemplageScriptUpdated = true;
				}
			}
		}

		if (vueScriptsUpdated) {
			tsProjectVersion++;
		}

		if (vueScriptsUpdated || tsFilesUpdated) {
			for (const uri of uris) {
				const sourceFile = sourceFiles.get(uri);
				if (!sourceFile) continue;
				const update = sourceFile.updateTemplateScript(tsProjectVersion);
				if (update) {
					vueTemplageScriptUpdated = true;
				}
			}
		}

		if (vueTemplageScriptUpdated) {
			tsProjectVersion++;
		}
	}
	function unsetSourceFiles(uris: string[]) {
		let count = 0;
		for (const uri of uris) {
			if (sourceFiles.delete(uri)) {
				count++;
			}
		}
		if (count >= 0) {
			tsProjectVersion++;
		}
	}
}
