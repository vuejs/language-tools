import * as vscode from 'vscode';

export function quickPick<T extends { [K: string]: vscode.QuickPickItem | undefined; }>(groups: T | T[], placeholder?: string) {
	return new Promise<keyof T | undefined>(resolve => {
		const quickPick = vscode.window.createQuickPick();
		const items: vscode.QuickPickItem[] = [];
		for (const group of Array.isArray(groups) ? groups : [groups]) {
			const groupItems = Object.values(group);
			if (groupItems.length) {
				if (items.length) {
					items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
				}
				for (const item of groupItems) {
					if (item) {
						items.push(item);
					}
				}
			}
		}
		quickPick.items = items;
		quickPick.placeholder = placeholder;
		quickPick.onDidChangeSelection(selection => {
			if (selection[0]) {
				for (const options of Array.isArray(groups) ? groups : [groups]) {
					for (let key in options) {
						const option = options[key];
						if (selection[0] === option) {
							resolve(key);
							quickPick.hide();
							break;
						}
					}
				}
			}
		});
		quickPick.onDidHide(() => {
			quickPick.dispose();
			resolve(undefined);
		});
		quickPick.show();
	});
}
