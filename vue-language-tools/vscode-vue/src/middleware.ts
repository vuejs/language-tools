import { AttrNameCasing, TagNameCasing } from '@volar/vue-language-server';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient';
import { attrNameCasings, tagNameCasings } from './features/nameCasing';

export const middleware: lsp.Middleware = {
	handleDiagnostics: (uri, diagnostics, next) => {
		const document = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
		if (document) {
			let outdated = false;
			for (const diagnostic of diagnostics) {
				const data = (diagnostic as any).data;
				if (typeof data === 'object' && 'version' in data) {
					if (document.version !== data.version) {
						outdated = true;
						break;
					}
				}
			}
			if (outdated) {
				return;
			}
		}
		next(uri, diagnostics);
	},
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
	}
};
