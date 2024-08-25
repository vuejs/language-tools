import * as vscode from 'vscode';

const _config = () => vscode.workspace.getConfiguration('vue');

export const config = {
	update: (section: string, value: any) => _config().update(section, value),
	get splitEditors(): Readonly<{
		icon: boolean;
		layout: { left: string[], right: string[]; };
	}> {
		return _config().get('splitEditors')!;
	},
	get doctor(): Readonly<{
		status: boolean;
	}> {
		return _config().get('doctor')!;
	},
	get server(): Readonly<{
		includeLanguages: string[];
		hybridMode: 'auto' | 'typeScriptPluginOnly' | boolean;
		maxOldSpaceSize: number;
	}> {
		return _config().get('server')!;
	},
	get updateImportsOnFileMove(): Readonly<{
		enabled: boolean;
	}> {
		return _config().get('updateImportsOnFileMove')!;
	},
	get codeActions(): Readonly<{
		enabled: boolean;
		askNewComponentName: boolean;
	}> {
		return _config().get('codeActions')!;
	},
	get codeLens(): Readonly<{
		enabled: boolean;
	}> {
		return _config().get('codeLens')!;
	},
	get complete(): Readonly<{
		casing: {
			props: 'autoKebab' | 'autoCamel' | 'kebab' | 'camel';
			tags: 'autoKebab' | 'autoPascal' | 'kebab' | 'pascal';
		};
	}> {
		return _config().get('complete')!;
	},
};
