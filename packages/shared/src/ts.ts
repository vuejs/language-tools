import * as fs from 'fs';
import type * as ts from 'typescript';
import type { MapLike } from 'typescript';
import * as path from 'upath';
import type * as vscode from 'vscode';

export function createTsLanguageService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	ShPlugin: typeof import('typescript-vscode-sh-plugin'),
	_host: ts.LanguageServiceHost,
) {
	// @ts-ignore
	const importSuggestionsCache = ts.Completions?.createImportSuggestionsForFileCache?.();
	const host = {
		..._host,
		// @ts-ignore
		// TODO: crash on 'addListener' from 'node:process', reuse because TS has same problem
		getImportSuggestionsCache: () => importSuggestionsCache,
	};
	const shPlugin = ShPlugin({ typescript: ts });
	let languageService = ts.createLanguageService(host);
	languageService = shPlugin.decorate(languageService);
	return languageService;
}

export function getWorkspaceTypescriptPath(tsdk: string, workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined) {
	if (path.isAbsolute(tsdk)) {
		const tsPath = path.join(tsdk, 'tsserverlibrary.js');
		if (fs.existsSync(tsPath)) {
			return tsPath;
		}
	}
	else if (workspaceFolders) {
		for (const folder of workspaceFolders) {
			const tsPath = path.join(folder.uri.fsPath, tsdk, 'tsserverlibrary.js');
			if (fs.existsSync(tsPath)) {
				return tsPath;
			}
		}
	}
}

export function getWorkspaceTypescriptLocalizedPath(tsdk: string, lang: string, workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined) {
	if (path.isAbsolute(tsdk)) {
		const tsPath = path.join(tsdk, lang, 'diagnosticMessages.generated.json');
		if (fs.existsSync(tsPath)) {
			return tsPath;
		}
	}
	else if (workspaceFolders) {
		for (const folder of workspaceFolders) {
			const tsPath = path.join(folder.uri.fsPath, tsdk, lang, 'diagnosticMessages.generated.json');
			if (fs.existsSync(tsPath)) {
				return tsPath;
			}
		}
	}
}

export function getVscodeTypescriptPath(appRoot: string) {
	return path.join(appRoot, 'extensions', 'node_modules', 'typescript', 'lib', 'typescript.js');
}

export function getVscodeTypescriptLocalizedPath(appRoot: string, lang: string): string | undefined {
	const tsPath = path.join(appRoot, 'extensions', 'node_modules', 'typescript', 'lib', lang, 'diagnosticMessages.generated.json');
	if (fs.existsSync(tsPath)) {
		return tsPath;
	}
}

export function loadTypescript(tsPath: string): typeof import('typescript/lib/tsserverlibrary') {
	return require(path.toUnix(tsPath));
}

export function loadTypescriptLocalized(tsPath: string): MapLike<string> | undefined {
	if (fs.existsSync(tsPath)) {
		return require(path.toUnix(tsPath));
	}
}

export function getTypeScriptVersion(serverPath: string): string | undefined {
	if (!fs.existsSync(serverPath)) {
		return undefined;
	}

	const p = serverPath.split(path.sep);
	if (p.length <= 2) {
		return undefined;
	}
	const p2 = p.slice(0, -2);
	const modulePath = p2.join(path.sep);
	let fileName = path.join(modulePath, 'package.json');
	if (!fs.existsSync(fileName)) {
		// Special case for ts dev versions
		if (path.basename(modulePath) === 'built') {
			fileName = path.join(modulePath, '..', 'package.json');
		}
	}
	if (!fs.existsSync(fileName)) {
		return undefined;
	}

	const contents = fs.readFileSync(fileName).toString();
	let desc: any = null;
	try {
		desc = JSON.parse(contents);
	} catch (err) {
		return undefined;
	}
	if (!desc || !desc.version) {
		return undefined;
	}
	return desc.version;
}
