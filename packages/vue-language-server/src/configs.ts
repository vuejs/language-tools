import * as vscode from 'vscode-languageserver';
import type * as css from 'vscode-css-languageservice';
import type * as html from 'vscode-html-languageservice'
import type * as vue from '@volar/vue-language-service';
import * as shared from '@volar/shared';

export function createLsConfigs(rootFolders: string[], connection: vscode.Connection) {

	let htmlCustomData: { [id: string]: html.HTMLDataV1 } | undefined;
	let cssCustomData: css.CSSDataV1[] | undefined;

	let settings: Record<string, Record<string, Promise<any>>> = {};

	const vueLsArr: vue.LanguageService[] = [];

	connection.onDidChangeConfiguration(async () => {
		settings = {};
		htmlCustomData = undefined;
		cssCustomData = undefined;

		for (const vueLs of vueLsArr) {
			vueLs.updateHtmlCustomData(await getHtmlCustomData());
			vueLs.updateCssCustomData(await getCssCustomData());
		}
	});

	return {
		getSettings,
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
	async function getSettings(section: string, scopeUri?: string) {
		if (!settings[section]) {
			settings[section] = {};
		}
		const uri = scopeUri ?? '';
		if (!settings[section][uri]) {
			settings[section][uri] = (async () => await connection.workspace.getConfiguration({ scopeUri, section }) ?? undefined)();
		}
		return settings[section][uri];
	}
}
