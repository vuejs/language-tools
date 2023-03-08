import { AttrNameCasing, TagNameCasing } from '@volar/vue-language-server';
import { overrideApplyingCodeActionData } from './common';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient';
import { attrNameCasings, tagNameCasings } from './features/nameCasing';

export const middleware: lsp.Middleware = {
	workspace: {
		configuration(params, token, next) {
			if (params.items.some(item => item.section === 'volar.completion.preferredAttrNameCase' || item.section === 'volar.completion.preferredTagNameCase')) {
				return params.items.map(item => {
					if (item.scopeUri) {
						if (item.section === 'volar.completion.preferredTagNameCase') {
							const tagNameCasing = tagNameCasings.get(item.scopeUri);
							if (tagNameCasing === TagNameCasing.Kebab) {
								return 'kebab';
							}
							else if (tagNameCasing === TagNameCasing.Pascal) {
								return 'pascal';
							}
						}
						if (item.section === 'volar.completion.preferredAttrNameCase') {
							const attrCase = attrNameCasings.get(item.scopeUri);
							if (attrCase === AttrNameCasing.Kebab) {
								return 'kebab';
							}
							if (attrCase === AttrNameCasing.Camel) {
								return 'camel';
							}
						}
					}
					return vscode.workspace.getConfiguration(item.section, item.scopeUri ? vscode.Uri.parse(item.scopeUri) : undefined);
				});
			}
			return next(params, token);
		},
	},
	async provideCodeActions(document, range, context, token, next) {
		const actions = await next(document, range, context, token);
		if (!actions) return;
		for (const action of actions) {
			if (action.command) continue;
			action.command = {
				title: '',
				command: '_volar.applyRefactor',
			};
		}

		return actions;
	},
	async resolveCodeAction(item, token, next) {
		const resolved = await next(item, token);
		if (!resolved) return resolved;
		overrideApplyingCodeActionData.command = (resolved as any).data?.command;
		// only edit is not ignored
		return resolved;
	},
};
