import type * as emmet from '@vscode/emmet-helper';
import * as vscode from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as tsConfigs from './tsConfigs';
import type * as css from 'vscode-css-languageservice';
import type * as html from 'vscode-html-languageservice'
import type * as vue from 'vscode-vue-languageservice';
import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary'; // fix build failed

export function createLsConfigs(rootFolders: string[], connection: vscode.Connection) {

	let emmetConfig: any | undefined;
	let tsPreferences: Record<string, Promise<ts.UserPreferences>> = {};
	let tsFormatOptions: Record<string, Promise<ts.FormatCodeSettings>> = {};
	let cssLanguageSettings: Record<string, Promise<css.LanguageSettings>> = {};
	let htmlHoverSettings: Record<string, Promise<html.HoverSettings>> = {};
	let codeLensConfigs: {
		references: boolean,
		pugTool: boolean,
		scriptSetupTool: boolean,
	} | undefined;
	let htmlCustomData: { [id: string]: html.HTMLDataV1 } | undefined;
	let cssCustomData: css.CSSDataV1[] | undefined;

	const vueLsArr: vue.LanguageService[] = [];

	connection.onDidChangeConfiguration(async () => {
		emmetConfig = undefined;
		codeLensConfigs = undefined;
		tsPreferences = {};
		tsFormatOptions = {};
		cssLanguageSettings = {};
		htmlHoverSettings = {};
		htmlCustomData = undefined;
		cssCustomData = undefined;

		for (const vueLs of vueLsArr) {
			vueLs.updateHtmlCustomData(await getHtmlCustomData());
			vueLs.updateCssCustomData(await getCssCustomData());
		}
	});

	return {
		getCodeLensConfigs,
		getEmmetConfiguration,
		getCssLanguageSettings,
		getTsPreferences,
		getTsFormatOptions,
		getHtmlHoverSettings,
		registerCustomData,
	};

	async function registerCustomData(vueLs: vue.LanguageService) {
		vueLsArr.push(vueLs);
		vueLs.updateHtmlCustomData(await getHtmlCustomData());
		vueLs.updateCssCustomData(await getCssCustomData());
	}
	async function getHtmlCustomData() {
		if (!htmlCustomData) {

			const paths = new Set<string>();
			const customData: string[] = await connection.workspace.getConfiguration({ section: 'html.customData' }) ?? [];
			const rootPaths = rootFolders.map(shared.uriToFsPath);

			for (const customDataPath of customData) {
				try {
					const jsonPath = require.resolve(customDataPath, { paths: rootPaths });
					paths.add(jsonPath);
				}
				catch (error) {
					console.error(error);
				}
			}

			htmlCustomData = {};

			for (const path of paths) {
				try {
					htmlCustomData[path] = require(path);
				}
				catch (error) {
					console.error(error);
				}
			}
		}
		return htmlCustomData;
	}
	async function getCssCustomData() {
		if (!cssCustomData) {

			const paths = new Set<string>();
			const customData: string[] = await connection.workspace.getConfiguration({ section: 'css.customData' }) ?? [];
			const rootPaths = rootFolders.map(shared.uriToFsPath);

			for (const customDataPath of customData) {
				try {
					const jsonPath = require.resolve(customDataPath, { paths: rootPaths });
					paths.add(jsonPath);
				}
				catch (error) {
					console.error(error);
				}
			}

			cssCustomData = [];

			for (const path of paths) {
				try {
					cssCustomData.push(require(path));
				}
				catch (error) {
					console.error(error);
				}
			}
		}
		return cssCustomData;
	}
	async function getHtmlHoverSettings(textDocument: TextDocument) {
		if (!htmlHoverSettings[textDocument.uri]) {
			htmlHoverSettings[textDocument.uri] = (async () => await connection.workspace.getConfiguration({ scopeUri: textDocument.uri, section: 'html.hover' }) ?? {})();
		}
		return htmlHoverSettings[textDocument.uri];
	}
	function getTsPreferences(textDocument: TextDocument) {
		return tsPreferences[textDocument.uri]
			?? (tsPreferences[textDocument.uri] = tsConfigs.getPreferences(connection.workspace, textDocument));
	}
	function getTsFormatOptions(textDocument: TextDocument, options?: vscode.FormattingOptions) {
		return tsFormatOptions[textDocument.uri]
			?? (tsFormatOptions[textDocument.uri] = tsConfigs.getFormatOptions(connection.workspace, textDocument, options));
	}
	function getCssLanguageSettings(textDocument: TextDocument): Promise<css.LanguageSettings> {
		if (!cssLanguageSettings[textDocument.uri]) {
			cssLanguageSettings[textDocument.uri] = (async () => await connection.workspace.getConfiguration({ scopeUri: textDocument.uri, section: textDocument.languageId }))();
		}
		return cssLanguageSettings[textDocument.uri];
	}
	async function getCodeLensConfigs() {
		if (!codeLensConfigs) {
			const [
				codeLensReferences,
				codeLensPugTool,
				codeLensRefScriptSetupTool,
			]: (boolean | null | undefined)[] = await Promise.all([
				connection.workspace.getConfiguration('volar.codeLens.references'),
				connection.workspace.getConfiguration('volar.codeLens.pugTools'),
				connection.workspace.getConfiguration('volar.codeLens.scriptSetupTools'),
			]);
			codeLensConfigs = {
				references: !!codeLensReferences,
				pugTool: !!codeLensPugTool,
				scriptSetupTool: !!codeLensRefScriptSetupTool,
			};
		}
		return codeLensConfigs;
	}
	async function getEmmetConfiguration(syntax: string): Promise<emmet.VSCodeEmmetConfig> {

		if (!emmetConfig) {
			emmetConfig = (await connection.workspace.getConfiguration('emmet')) ?? {};
		}

		const syntaxProfiles = Object.assign({}, emmetConfig['syntaxProfiles'] || {});
		const preferences = Object.assign({}, emmetConfig['preferences'] || {});
		// jsx, xml and xsl syntaxes need to have self closing tags unless otherwise configured by user
		if (syntax === 'jsx' || syntax === 'xml' || syntax === 'xsl') {
			syntaxProfiles[syntax] = syntaxProfiles[syntax] || {};
			if (typeof syntaxProfiles[syntax] === 'object'
				&& !syntaxProfiles[syntax].hasOwnProperty('self_closing_tag') // Old Emmet format
				&& !syntaxProfiles[syntax].hasOwnProperty('selfClosingStyle') // Emmet 2.0 format
			) {
				syntaxProfiles[syntax] = {
					...syntaxProfiles[syntax],
					selfClosingStyle: 'xml'
				};
			}
		}

		return {
			preferences,
			showExpandedAbbreviation: emmetConfig['showExpandedAbbreviation'],
			showAbbreviationSuggestions: emmetConfig['showAbbreviationSuggestions'],
			syntaxProfiles,
			variables: emmetConfig['variables'],
			excludeLanguages: emmetConfig['excludeLanguages'],
			showSuggestionsAsSnippets: emmetConfig['showSuggestionsAsSnippets']
		};
	}
}
