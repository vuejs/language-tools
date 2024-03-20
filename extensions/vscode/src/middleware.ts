import { middleware as baseMiddleware } from '@volar/vscode';
import { AttrNameCasing, TagNameCasing } from '@vue/language-server';
import * as vscode from 'vscode';
import type * as lsp from 'vscode-languageclient';
import { attrNameCasings, tagNameCasings } from './features/nameCasing';

export const middleware: lsp.Middleware = {
	...baseMiddleware,
	async resolveCodeAction(item, token, next) {
		if (item.kind?.value === 'refactor.move.newFile.dumb') {
			const inputName = await vscode.window.showInputBox({ value: (item as any).data.original.data.newName });
			if (!inputName) {
				return item; // cancel
			}
			(item as any).data.original.data.newName = inputName;
		}
		return await (baseMiddleware.resolveCodeAction?.(item, token, next) ?? next(item, token));
	},
	workspace: {
		configuration(params, token, next) {
			if (params.items.some(item => item.section === 'vue.complete.casing.props' || item.section === 'vue.complete.casing.tags')) {
				return params.items.map(item => {
					if (item.scopeUri) {
						if (item.section === 'vue.complete.casing.tags') {
							const tagNameCasing = tagNameCasings.get(item.scopeUri);
							if (tagNameCasing === TagNameCasing.Kebab) {
								return 'kebab';
							}
							else if (tagNameCasing === TagNameCasing.Pascal) {
								return 'pascal';
							}
						}
						else if (item.section === 'vue.complete.casing.props') {
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
};
