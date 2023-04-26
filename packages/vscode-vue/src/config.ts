import * as vscode from 'vscode';

const volarConfigs = () => vscode.workspace.getConfiguration('volar');
const vueConfigs = () => vscode.workspace.getConfiguration('vue');

export const config = {
	splitEditors: {
		get layout() {
			return volarConfigs().get<{ left: string[], right: string[]; }>('splitEditors.layout') ?? { left: [], right: [] };
		}
	},
	features: {
		updateImportsOnFileMove: {
			get enable() {
				return vueConfigs().get<boolean>('features.updateImportsOnFileMove.enable');
			},
		},
		codeActions: {
			get enable() {
				return vueConfigs().get<boolean>('features.codeActions.enable');
			},
			set enable(value) {
				vueConfigs().update('features.codeActions.enable', value);
			},
			get savingTimeLimit() {
				return vueConfigs().get<number>('features.codeActions.savingTimeLimit') ?? -1;
			},
		},
		codeLens: {
			get enable() {
				return vueConfigs().get<boolean>('features.codeLens.enable');
			},
		},
		complete: {
			casing: {
				get status() {
					return vueConfigs().get<boolean>('features.complete.casing.status');
				},
				get props() {
					return vueConfigs().get<'autoKebab' | 'autoCamel' | 'kebab' | 'camel'>('features.complete.casing.props');
				},
				get tags() {
					return vueConfigs().get<'autoKebab' | 'autoPascal' | 'kebab' | 'pascal'>('features.complete.casing.tags');
				},
			},
		},
	},
	json: {
		get customBlockSchemaUrls() {
			return volarConfigs().get<Record<string, string>>('json.customBlockSchemaUrls');
		}
	},
	server: {
		get maxOldSpaceSize() {
			return vueConfigs().get<number>('server.maxOldSpaceSize');
		},
		get maxFileSize() {
			return vueConfigs().get<number>('server.maxFileSize');
		},
		get reverseConfigFilePriority() {
			return vueConfigs().get<boolean>('server.reverseConfigFilePriority');
		},
		get diagnosticModel() {
			return vueConfigs().get<'push' | 'pull'>('server.diagnosticModel');
		},
		get additionalExtensions() {
			return vueConfigs().get<string[]>('server.additionalExtensions') ?? [];
		},
		get fullCompletionList() {
			return vueConfigs().get<boolean>('server.fullCompletionList');
		},
		get configFilePath() {
			return vueConfigs().get<string>('server.configFilePath');
		},
		petiteVue: {
			get supportHtmlFile() {
				return vueConfigs().get<boolean>('server.petiteVue.supportHtmlFile');
			},
		},
		vitePress: {
			get supportMdFile() {
				return vueConfigs().get<boolean>('server.vitePress.supportMdFile');
			},
		},
	},
	doctor: {
		get status() {
			return volarConfigs().get<boolean>('doctor.status');
		},
	},
};
