import { posix as path } from 'path';
import { createSourceFile, SourceFile, VueLanguagePlugin } from './sourceFile';
import { VueLanguageServiceHost } from './types';
import * as localTypes from './utils/localTypes';
import { createLanguageContext, EmbeddedLanguageModule } from '@volar/embedded-typescript-language-core';
import { getDefaultVueLanguagePlugins } from './plugins';
import { getVueCompilerOptions } from './utils/ts';
import type * as _ from 'typescript/lib/tsserverlibrary';

export type VueLanguageContext = ReturnType<typeof createVueLanguageContext>;

export function createVueLanguageContext(
	host: VueLanguageServiceHost,
	extraPlugins: VueLanguagePlugin[] = [],
	exts: string[] = ['.vue', '.html', '.md'],
) {

	const ts = host.getTypeScriptModule();

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

	const compilerOptions = host.getCompilationSettings();
	const vueCompilerOptions = getVueCompilerOptions(host.getVueCompilationSettings());
	const sharedTypesScript = ts.ScriptSnapshot.fromString(localTypes.getTypesCode(vueCompilerOptions.target));
	const plugins = getDefaultVueLanguagePlugins(ts, host.getCurrentDirectory(), compilerOptions, vueCompilerOptions, extraPlugins);
	const vueLanguageModule: EmbeddedLanguageModule = {
		createSourceFile(fileName, snapshot) {
			if (exts.some(ext => fileName.endsWith(ext))) {
				return createSourceFile(fileName, snapshot, ts, plugins);
			}
		},
		updateSourceFile(sourceFile: SourceFile, snapshot) {
			sourceFile.update(snapshot);
		},
	};
	const host_2: Partial<VueLanguageServiceHost> = {
		fileExists(fileName) {

			const basename = path.basename(fileName);
			if (basename === localTypes.typesFileName) {
				return true;
			}

			return host.fileExists(fileName);
		},
		getScriptFileNames() {
			return [
				...core.__internal__.mapper.getDirs().map(dir => path.join(dir, localTypes.typesFileName)),
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
				return sharedTypesScript;
			}
			let snapshot = host.getScriptSnapshot(fileName);
			if (snapshot) {
				if (!(vueCompilerOptions.strictTemplates ?? false) && (
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
	const proxyHost = new Proxy(host, {
		get(target, p: keyof VueLanguageServiceHost) {
			if (p in host_2) {
				return host_2[p];
			}
			return target[p];
		}
	});
	const core = createLanguageContext(proxyHost, [vueLanguageModule]);

	return {
		...core,
		plugins,
	};
}
