import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient';
import { attrCases } from './features/attrNameCase';
import { tagCases } from './features/tagNameCase';

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
							const tagCase = tagCases.uriGet(item.scopeUri);
							if (tagCase === 'kebabCase') {
								return 'kebab';
							}
							if (tagCase === 'pascalCase') {
								return 'pascal';
							}
							return 'auto';
						}
						if (item.section === 'volar.completion.preferredAttrNameCase') {
							const attrCase = attrCases.uriGet(item.scopeUri);
							if (attrCase === 'kebabCase') {
								return 'kebab';
							}
							if (attrCase === 'camelCase') {
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
