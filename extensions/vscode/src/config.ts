import { defineConfigs } from 'reactive-vscode';

export const config = defineConfigs('vue', {
	splitEditors: {} as {
		icon: boolean;
		layout: {
			left: string[];
			right: string[];
		}
	},
	doctor: {} as {
		status: boolean;
	},
	server: {} as {
		includeLanguages: string[];
		hybridMode: 'auto' | 'typeScriptPluginOnly' | boolean;
		maxOldSpaceSize: number;
	},
	updateImportsOnFileMove: {} as {
		enabled: boolean;
	},
	codeActions: {} as {
		enabled: boolean;
		askNewComponentName: boolean;
	},
	codeLens: {} as {
		enabled: boolean;
	},
	complete: {} as {
		casing: {
			props: 'autoKebab' | 'autoCamel' | 'kebab' | 'camel';
			tags: 'autoKebab' | 'autoPascal' | 'kebab' | 'pascal';
		};
	}
});