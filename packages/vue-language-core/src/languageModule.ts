import type * as embedded from '@volar/language-core';
import { posix as path } from 'path';
import { getDefaultVueLanguagePlugins } from './plugins';
import { VueSourceFile } from './sourceFile';
import { VueLanguagePlugin, VueCompilerOptions } from './types';
import * as localTypes from './utils/localTypes';
import { resolveVueCompilerOptions } from './utils/ts';

export function createEmbeddedLanguageModule(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	rootDir: string,
	compilerOptions: ts.CompilerOptions,
	_vueCompilerOptions: VueCompilerOptions,
	extraPlugins: VueLanguagePlugin[] = [],
	exts: string[] = ['.vue', '.html', '.md'],
): embedded.EmbeddedLanguageModule {

	const vueLanguagePlugin = getDefaultVueLanguagePlugins(
		ts,
		rootDir,
		compilerOptions,
		_vueCompilerOptions,
		extraPlugins,
	);

	// from https://github.com/johnsoncodehk/volar/pull/1543
	if (!((ts as any).__VLS_pitched_resolveModuleNames)) {
		(ts as any).__VLS_pitched_resolveModuleNames = true;
		const resolveModuleNames = ts.resolveModuleName;
		ts.resolveModuleName = (...args) => {
			if (args[6] === ts.ModuleKind.ESNext && exts.some(ext => args[0].endsWith(ext))) {
				args[6] = ts.ModuleKind.CommonJS;
			}
			return resolveModuleNames(...args);
		};
	}

	const vueCompilerOptions = resolveVueCompilerOptions(_vueCompilerOptions);
	const sharedTypesSnapshot = ts.ScriptSnapshot.fromString(localTypes.getTypesCode(vueCompilerOptions.target));
	const languageModule: embedded.EmbeddedLanguageModule = {
		createSourceFile(fileName, snapshot) {
			if (exts.some(ext => fileName.endsWith(ext))) {
				return new VueSourceFile(fileName, snapshot, ts, vueLanguagePlugin);
			}
		},
		updateSourceFile(sourceFile: VueSourceFile, snapshot) {
			sourceFile.update(snapshot);
		},
		proxyLanguageServiceHost(host) {
			return {
				fileExists(fileName) {
					const basename = path.basename(fileName);
					if (basename === localTypes.typesFileName) {
						return true;
					}
					return host.fileExists(fileName);
				},
				getScriptFileNames() {
					const fileNames = host.getScriptFileNames();
					return [
						...getDirs(fileNames).map(dir => path.join(dir, localTypes.typesFileName)),
						...host.getScriptFileNames(),
					];
				},
				getScriptVersion(fileName) {
					const basename = path.basename(fileName);
					if (basename === localTypes.typesFileName) {
						return '';
					}
					return host.getScriptVersion(fileName);
				},
				getScriptSnapshot(fileName) {
					const basename = path.basename(fileName);
					if (basename === localTypes.typesFileName) {
						return sharedTypesSnapshot;
					}
					let snapshot = host.getScriptSnapshot(fileName);
					if (snapshot) {
						if (!vueCompilerOptions.strictTemplates && (
							// for vue 2.6 and vue 3
							basename === 'runtime-dom.d.ts' ||
							// for vue 2.7
							basename === 'jsx.d.ts'
						)) {
							// allow arbitrary attributes
							let tsScriptText = snapshot.getText(0, snapshot.getLength());
							tsScriptText = tsScriptText.replace(
								'type ReservedProps = {',
								'type ReservedProps = { [name: string]: any',
							);
							snapshot = ts.ScriptSnapshot.fromString(tsScriptText);
						}
					}
					return snapshot;
				},
			};
		},
	};

	return languageModule;

	function getDirs(fileNames: string[]) {
		return [...new Set(fileNames.map(path.dirname))];
	}
}
