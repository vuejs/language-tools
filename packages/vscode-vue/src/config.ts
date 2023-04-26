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
	vueserver: {
		get maxOldSpaceSize() {
			return volarConfigs().get<number>('vueserver.maxOldSpaceSize');
		},
		get maxFileSize() {
			return volarConfigs().get<number>('vueserver.maxFileSize');
		},
		get reverseConfigFilePriority() {
			return volarConfigs().get<boolean>('vueserver.reverseConfigFilePriority');
		},
		get diagnosticModel() {
			return volarConfigs().get<'push' | 'pull'>('vueserver.diagnosticModel');
		},
		get additionalExtensions() {
			return volarConfigs().get<string[]>('vueserver.additionalExtensions') ?? [];
		},
		get fullCompletionList() {
			return volarConfigs().get<boolean>('vueserver.fullCompletionList');
		},
		get configFilePath() {
			return volarConfigs().get<string>('vueserver.configFilePath');
		},
		petiteVue: {
			get processHtmlFile() {
				return volarConfigs().get<boolean>('vueserver.petiteVue.processHtmlFile');
			},
		},
		vitePress: {
			get processMdFile() {
				return volarConfigs().get<boolean>('vueserver.vitePress.processMdFile');
			},
		},
	},
	doctor: {
		get status() {
			return volarConfigs().get<boolean>('doctor.status');
		},
	},
	nameCasing: {
		get status() {
			return volarConfigs().get<boolean>('nameCasing.status');
		},
	},
};
