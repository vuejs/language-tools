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
		maxOldSpaceSize: number;
		maxFileSize: number;
		reverseConfigFilePriority: boolean;
		diagnosticModel: 'push' | 'pull';
		additionalExtensions: string[];
		fullCompletionList: boolean;
		configFilePath: string;
		vitePress: {
			supportMdFile: boolean;
		};
		petiteVue: {
			supportHtmlFile: boolean;
		};
		json: {
			customBlockSchemaUrls: Record<string, string>;
		};
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
		savingTimeLimit: number;
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
			status: boolean;
			props: 'autoKebab' | 'autoCamel' | 'kebab' | 'camel';
			tags: 'autoKebab' | 'autoPascal' | 'kebab' | 'pascal';
		};
	}> {
		return _config().get('complete')!;
	},
};
