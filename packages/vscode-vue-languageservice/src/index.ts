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
import * as upath from 'upath';
import * as ts from 'typescript';
import * as ts2 from '@volar/vscode-typescript-languageservice';
import * as css from 'vscode-css-languageservice';
import * as html from 'vscode-html-languageservice';
import * as doComplete from './languageFeatures/completions';
import * as doCompletionResolve from './languageFeatures/completionResolve';
import * as doAutoClose from './languageFeatures/autoClose';
import * as getEmbeddedLanguage from './languageFeatures/embeddedLanguage';
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
export { LanguageServiceHost } from 'typescript';
export type LanguageService = ReturnType<typeof createLanguageService>;
export { triggerCharacter } from './languageFeatures/completions';

export function createLanguageService(vueHost: ts.LanguageServiceHost) {

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
		doValidation: apiHook(doValidation.register(sourceFiles, () => tsProjectVersion.toString())),
		doHover: apiHook(doHover.register(sourceFiles)),
		doRangeFormatting: apiHook(doRangeFormatting.register(sourceFiles)),
		doFormatting: apiHook(doFormatting.register(sourceFiles)),
		findDefinition: apiHook(findDefinition.register(sourceFiles)),
		findReferences: apiHook(findReferences.register(sourceFiles, tsLanguageService)),
		findTypeDefinition: apiHook(findTypeDefinition.register(sourceFiles)),
		doRename: apiHook(doRename.register(sourceFiles)),
		doCodeAction: apiHook(doCodeAction),
		doExecuteCommand: apiHook(doExecuteCommand),
		doComplete: apiHook(doComplete.register(sourceFiles), false),
		doCompletionResolve: apiHook(doCompletionResolve.register(sourceFiles), false),
		doAutoClose: apiHook(doAutoClose.register(sourceFiles, htmlLanguageService), false),
		getEmbeddedLanguage: apiHook(getEmbeddedLanguage.register(sourceFiles), false),
		getSignatureHelp: apiHook(getSignatureHelp.register(sourceFiles), false),
		getSelectionRanges: apiHook(getSelectionRanges.register(sourceFiles), false),
		getColorPresentations: apiHook(getColorPresentations.register(sourceFiles), false),
		findDocumentHighlights: apiHook(findDocumentHighlights.register(sourceFiles), false),
		findDocumentSymbols: apiHook(findDocumentSymbols.register(sourceFiles), false),
		findDocumentLinks: apiHook(findDocumentLinks.register(sourceFiles, vueHost), false),
		findDocumentColors: apiHook(findDocumentColors.register(sourceFiles), false),
		dispose: tsLanguageService.dispose,
	};

	function apiHook<T extends Function>(api: T, shouldUpdateTemplateScript: boolean = true) {
		const handler = {
			apply: function (target: Function, thisArg: any, argumentsList: any[]) {
				update(shouldUpdateTemplateScript);
				return target.apply(thisArg, argumentsList);
			}
		};
		return new Proxy(api, handler) as T;
	}
	function update(shouldUpdateTemplateScript: boolean) {
		const currentVersion = vueHost.getProjectVersion?.();
		if (currentVersion === undefined || currentVersion !== lastProjectVersion) {

			let tsFileChanged = false;
			lastProjectVersion = currentVersion;
			const oldFiles = new Set([...lastScriptVersions.keys()]);
			const newFiles = new Set(vueHost.getScriptFileNames());
			const removes: string[] = [];
			const adds: string[] = [];
			const updates: string[] = [];

			for (const fileName of oldFiles) {
				if (!newFiles.has(fileName)) {
					if (fileName.endsWith('.vue')) {
						removes.push(fileName);
					}
					else {
						tsFileChanged = true;
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
						tsFileChanged = true;
					}
					lastScriptVersions.set(fileName, vueHost.getScriptVersion(fileName));
				}
			}
			for (const fileName of oldFiles) {
				if (newFiles.has(fileName)) {
					const oldVersion = lastScriptVersions.get(fileName);
					const newVersion = vueHost.getScriptVersion(fileName);
					if (oldVersion !== newVersion) {
						if (fileName.endsWith('.vue')) {
							updates.push(fileName);
						}
						else {
							tsFileChanged = true;
						}
						lastScriptVersions.set(fileName, newVersion);
					}
				}
			}

			if (tsFileChanged) {
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
			updateSourceFiles(adds.concat(updates).map(fsPathToUri), shouldUpdateTemplateScript)
		}
	}
	function createTsLanguageServiceHost() {
		const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
		ts.sys.getDirectories
		const tsHost: ts2.LanguageServiceHost = {
			...vueHost,
			getProjectVersion: () => tsProjectVersion.toString(),
			getScriptFileNames,
			getScriptVersion,
			getScriptSnapshot,
			readDirectory: (path, extensions, exclude, include, depth) => {
				const result = ts.sys.readDirectory(path, extensions, exclude, include, depth);
				for (const [uri, sourceFile] of sourceFiles) {
					const vuePath = uriToFsPath(uri);
					const vuePath2 = upath.join(path, upath.basename(vuePath));
					if (upath.relative(path.toLowerCase(), vuePath.toLowerCase()).startsWith('..')) {
						continue;
					}
					if (!depth && vuePath.toLowerCase() === vuePath2.toLowerCase()) {
						result.push(vuePath2);
					}
					else if (depth) {
						result.push(vuePath2); // TODO: depth num
					}
				}
				return result;
			},
		};

		return tsHost;

		function getScriptFileNames() {
			const tsFileNames: string[] = [];
			for (const fileName of vueHost.getScriptFileNames()) {
				const uri = fsPathToUri(fileName);
				const sourceFile = sourceFiles.get(uri);
				if (sourceFile) {
					for (const [uri] of sourceFile.getTsDocuments()) {
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
			return vueHost.getScriptVersion(fileName);
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
			return vueHost.getScriptSnapshot(fileName);
		}
	}
	function doCodeAction(document: TextDocument, range: Range): CodeAction[] {
		if (range.start.line != range.end.line) return [];

		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return [];

		const desc = sourceFile.getDescriptor();
		if (!desc.template) return [];

		const handlerLine = range.start.line;
		const templateStartLine = document.positionAt(desc.template.loc.start).line;
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
			const newTemplate = `<template lang="pug">` + pug;

			let start = desc.template.loc.start - '<template>'.length;
			const end = desc.template.loc.end;
			const startMatch = '<template';

			while (!document.getText(Range.create(
				document.positionAt(start),
				document.positionAt(start + startMatch.length),
			)).startsWith(startMatch)) {
				start--;
				if (start < 0) {
					throw `Can't find start of tag <template>`
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
			const newTemplate = `<template>\n` + html;

			let start = desc.template.loc.start - '<template>'.length;
			const end = desc.template.loc.end;
			const startMatch = '<template';

			while (!document.getText(Range.create(
				document.positionAt(start),
				document.positionAt(start + startMatch.length),
			)).startsWith(startMatch)) {
				start--;
				if (start < 0) {
					throw `Can't find start of tag <template>`
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
		const version = Number(vueHost.getScriptVersion(fileName));
		if (!documents.has(uri) || documents.get(uri)!.version !== version) {
			const scriptSnapshot = vueHost.getScriptSnapshot(fileName);
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
	function updateSourceFiles(uris: string[], shouldUpdateTemplateScript: boolean) {
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

		if (shouldUpdateTemplateScript) {
			for (const uri of uris) {
				const sourceFile = sourceFiles.get(uri);
				if (!sourceFile) continue;
				const updated = sourceFile.updateTemplateScript(tsProjectVersion);
				if (updated) {
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
		if (count > 0) {
			tsProjectVersion++;
		}
	}
}
