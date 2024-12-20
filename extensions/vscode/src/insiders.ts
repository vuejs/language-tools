import { quickPick } from '@volar/vscode/lib/common';
import { executeCommand, useCommand } from 'reactive-vscode';
import * as vscode from 'vscode';

export function useInsidersStatusItem(context: vscode.ExtensionContext) {
	const item = vscode.languages.createLanguageStatusItem('vue-insider', 'vue');
	item.command = {
		title: 'Fetch Versions',
		command: 'vue-insiders.fetch',
	};
	let status: 'idle' | 'pending' | 'success' = 'idle';

	useCommand('vue-insiders.fetch', () => {
		if (status === 'idle') {
			fetchJson();
		}
	});

	fetchJson();

	async function fetchJson() {
		item.busy = true;
		item.text = 'Checking for Updates...';
		item.severity = vscode.LanguageStatusSeverity.Warning;
		status = 'pending';

		for (const url of [
			'https://raw.githubusercontent.com/vuejs/language-tools/HEAD/insiders.json',
			'https://cdn.jsdelivr.net/gh/vuejs/language-tools/insiders.json',
		]) {
			try {
				const controller = new AbortController();
				setTimeout(() => controller.abort(), 15000);

				const res = await fetch(url, {
					signal: controller.signal,
				});
				onJson(await res.json() as any);
				status = 'success';
				break;
			}
			catch { };
		}

		item.busy = false;
		if (status !== 'success') {
			item.text = 'Failed to Fetch Versions';
			item.severity = vscode.LanguageStatusSeverity.Error;
			status = 'idle';
		}
	}

	function onJson(json: {
		latest: string;
		versions: {
			version: string;
			date: string;
			downloads: {
				GitHub: string;
				AFDIAN: string;
			};
		}[];
	}) {
		item.detail = undefined;
		item.command = {
			title: 'Select Version',
			command: 'vue-insiders.update',
		};
		if (
			json.versions.some(
				version => version.version === context.extension.packageJSON.version
			)
		) {
			item.text = '🚀 Insiders Edition';
			item.severity = vscode.LanguageStatusSeverity.Information;

			if (context.extension.packageJSON.version !== json.latest) {
				item.detail = 'New Version Available!';
				item.severity = vscode.LanguageStatusSeverity.Warning;
				vscode.window
					.showInformationMessage('New Insiders Version Available!', 'Download')
					.then(download => {
						if (download) {
							executeCommand('vue-insiders.update');
						}
					});
			}
		}
		else {
			item.text = '✨ Get Insiders Edition';
			item.severity = vscode.LanguageStatusSeverity.Warning;
		}

		useCommand('vue-insiders.update', async () => {
			const quickPickItems: { [version: string]: vscode.QuickPickItem; } = {};
			for (const { version, date } of json.versions) {
				let description = date;
				if (context.extension.packageJSON.version === version) {
					description += ' (current)';
				}
				quickPickItems[version] = {
					label: version,
					description,
				};
			}
			const version = await quickPick([
				quickPickItems,
				{
					learnMore: {
						label: 'Learn more about Insiders Edition',
					},
					joinViaGitHub: {
						label: 'Join via GitHub Sponsors',
					},
					joinViaAFDIAN: {
						label: 'Join via AFDIAN (爱发电)',
					},
				},
			]);
			if (version === 'learnMore') {
				vscode.env.openExternal(
					vscode.Uri.parse(
						'https://github.com/vuejs/language-tools/wiki/Get-Insiders-Edition'
					)
				);
			}
			else if (version === 'joinViaGitHub') {
				vscode.env.openExternal(
					vscode.Uri.parse('https://github.com/sponsors/johnsoncodehk')
				);
			}
			else if (version === 'joinViaAFDIAN') {
				vscode.env.openExternal(
					vscode.Uri.parse('https://afdian.net/a/johnsoncodehk')
				);
			}
			else {
				const downloads = json.versions.find(
					v => v.version === version
				)?.downloads;
				if (downloads) {
					const quickPickItems: { [key: string]: vscode.QuickPickItem; } = {
						GitHub: {
							label: `${version} - GitHub Releases`,
							description: 'Access via GitHub Sponsors',
							detail: downloads.GitHub,
						},
						AFDIAN: {
							label: `${version} - Insiders 电圈`,
							description: 'Access via AFDIAN (爱发电)',
							detail: downloads.AFDIAN,
						},
					};
					const otherItems: { [key: string]: vscode.QuickPickItem; } = {
						learnMore: {
							label: 'Learn more about Insiders Edition',
						},
						joinViaGitHub: {
							label: 'Join via GitHub Sponsors',
						},
						joinViaAFDIAN: {
							label: 'Join via AFDIAN (爱发电)',
						},
					};
					const option = await quickPick([quickPickItems, otherItems]);
					if (option === 'learnMore') {
						vscode.env.openExternal(
							vscode.Uri.parse(
								'https://github.com/vuejs/language-tools/wiki/Get-Insiders-Edition'
							)
						);
					}
					else if (option === 'joinViaGitHub') {
						vscode.env.openExternal(
							vscode.Uri.parse('https://github.com/sponsors/johnsoncodehk')
						);
					}
					else if (option === 'joinViaAFDIAN') {
						vscode.env.openExternal(
							vscode.Uri.parse('https://afdian.net/a/johnsoncodehk')
						);
					}
					else if (option) {
						vscode.env.openExternal(
							vscode.Uri.parse(downloads[option as keyof typeof downloads])
						);
					}
				}
			}
		});
	}
}