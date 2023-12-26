import { runTsc } from '@volar/typescript/lib/quickstart/runTsc';
import * as vue from '@vue/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';

export function run() {

	let runExtensions = ['.vue'];

	const windowsPathReg = /\\/g;
	const extensionsChangedException = new Error('extensions changed');
	const main = () => runTsc(
		require.resolve('typescript/lib/tsc'),
		runExtensions,
		(ts, options) => {
			const { configFilePath } = options.options;
			const vueOptions = typeof configFilePath === 'string'
				? vue.createParsedCommandLine(ts, ts.sys, configFilePath.replace(windowsPathReg, '/')).vueOptions
				: {};
			const extensions = vueOptions.extensions ?? ['.vue'];
			if (
				runExtensions.length === extensions.length
				&& runExtensions.every(ext => extensions.includes(ext))
			) {
				return vue.createLanguages(
					ts,
					options.options,
					vueOptions,
					false,
					createFakeGlobalTypesHolder(options)?.replace(windowsPathReg, '/'),
				);
			}
			else {
				runExtensions = extensions;
				throw extensionsChangedException;
			}
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

		return fakeFileName;
	}
}
