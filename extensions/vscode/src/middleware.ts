import * as lsp from '@volar/vscode';
import * as vscode from 'vscode';
import { config } from './config';

export const middleware: lsp.Middleware = {
	...lsp.middleware,
	async resolveCodeAction(item, token, next) {
		if (item.kind?.value === 'refactor.move.newFile.dumb' && config.codeActions.askNewComponentName) {
			const inputName = await vscode.window.showInputBox({ value: (item as any).data.original.data.newName });
			if (!inputName) {
				return item; // cancel
			}
			(item as any).data.original.data.newName = inputName;
		}
		return await (lsp.middleware.resolveCodeAction?.(item, token, next) ?? next(item, token));
	},
};
