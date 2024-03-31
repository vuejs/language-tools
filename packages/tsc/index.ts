import { runTsc } from '@volar/typescript/lib/quickstart/runTsc';
import * as vue from '@vue/language-core';
import type * as ts from 'typescript';

const windowsPathReg = /\\/g;

export function run() {

	let runExtensions = ['.vue'];

	const extensionsChangedException = new Error('extensions changed');
	const main = () => runTsc(
		require.resolve('typescript/lib/tsc'),
		runExtensions,
		(ts, options) => {
			const { configFilePath } = options.options;
			const vueOptions = typeof configFilePath === 'string'
				? vue.createParsedCommandLine(ts, ts.sys, configFilePath.replace(windowsPathReg, '/')).vueOptions
				: vue.resolveVueCompilerOptions({});
			const fakeGlobalTypesHolder = createFakeGlobalTypesHolder(options);
			if (
				runExtensions.length === vueOptions.extensions.length
				&& runExtensions.every(ext => vueOptions.extensions.includes(ext))
			) {
				const vueLanguagePlugin = vue.createVueLanguagePlugin(
					ts,
					id => id,
					fileName => fileName === fakeGlobalTypesHolder,
					options.options,
					vueOptions,
					false,
				);
				return [vueLanguagePlugin];
			}
			else {
				runExtensions = vueOptions.extensions;
				throw extensionsChangedException;
			}
		},
		fileName => {
			if (runExtensions.some(ext => fileName.endsWith(ext))) {
				return 'vue';
			}
			return vue.resolveCommonLanguageId(fileName);
		},
	);

	try {
		main();
	} catch (err) {
		if (err === extensionsChangedException) {
			main();
		}
	}
}

export function createFakeGlobalTypesHolder(options: ts.CreateProgramOptions) {
	const firstVueFile = options.rootNames.find(fileName => fileName.endsWith('.vue'));
	if (firstVueFile) {
		const fakeFileName = firstVueFile + '__VLS_globalTypes.vue';

		(options.rootNames as string[]).push(fakeFileName);

		const fileExists = options.host!.fileExists.bind(options.host);
		const readFile = options.host!.readFile.bind(options.host);
		const writeFile = options.host!.writeFile.bind(options.host);

		options.host!.fileExists = fileName => {
			if (fileName.endsWith('__VLS_globalTypes.vue')) {
				return true;
			}
			return fileExists(fileName);
		};
		options.host!.readFile = fileName => {
			if (fileName.endsWith('__VLS_globalTypes.vue')) {
				return '<script setup lang="ts"></script>';
			}
			return readFile(fileName);
		};
		options.host!.writeFile = (fileName, ...args) => {
			if (fileName.endsWith('__VLS_globalTypes.vue.d.ts')) {
				return;
			}
			return writeFile(fileName, ...args);
		};

		return fakeFileName.replace(windowsPathReg, '/');
	}
}
