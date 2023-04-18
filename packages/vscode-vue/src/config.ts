import * as vscode from 'vscode';

const _configs = vscode.workspace.getConfiguration('volar');

export const config = {
	splitEditors: {
		get layout() {
			return _configs.get<{ left: string[], right: string[]; }>('splitEditors.layout') ?? { left: [], right: [] };
		}
	},
	features: {
		updateImportsOnFileMove: {
			get enable() {
				return _configs.get<boolean>('features.updateImportsOnFileMove.enable');
			},
		},
		codeActions: {
			get enable() {
				return _configs.get<boolean>('features.codeActions.enable');
			},
		},
		codeLens: {
			get enable() {
				return _configs.get<boolean>('features.codeLens.enable');
			},
		},
		complete: {
			get attrNameCasing() {
				return _configs.get<'autoKebab' | 'autoCamel' | 'kebab' | 'camel'>('features.complete.propNameCasing');
			},
			get tagNameCasing() {
				return _configs.get<'autoKebab' | 'autoPascal' | 'kebab' | 'pascal'>('features.complete.tagNameCasing');
			},
		},
	},
	json: {
		get customBlockSchemaUrls() {
			return _configs.get<Record<string, string>>('json.customBlockSchemaUrls');
		}
	},
	vueserver: {
		get maxOldSpaceSize() {
			return _configs.get<number>('vueserver.maxOldSpaceSize');
		},
		get maxFileSize() {
			return _configs.get<number>('vueserver.maxFileSize');
		},
		get reverseConfigFilePriority() {
			return _configs.get<boolean>('vueserver.reverseConfigFilePriority');
		},
		get diagnosticModel() {
			return _configs.get<'push' | 'pull'>('vueserver.diagnosticModel');
		},
		get additionalExtensions() {
			return _configs.get<string[]>('vueserver.additionalExtensions') ?? [];
		},
		get fullCompletionList() {
			return _configs.get<boolean>('vueserver.fullCompletionList');
		},
		get configFilePath() {
			return _configs.get<string>('vueserver.configFilePath');
		},
		get fileWatches() {
			return _configs.get<boolean>('volar.vueserver.fileWatchers');
		},
		petiteVue: {
			get processHtmlFile() {
				return _configs.get<boolean>('vueserver.petiteVue.processHtmlFile');
			},
		},
		vitePress: {
			get processMdFile() {
				return _configs.get<boolean>('vueserver.vitePress.processMdFile');
			},
		},
	},
	doctor: {
		get status() {
			return _configs.get<boolean>('doctor.status');
		}
	}
};
