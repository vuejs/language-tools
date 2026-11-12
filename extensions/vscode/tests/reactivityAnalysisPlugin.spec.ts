import { createLanguage, createVueLanguagePlugin, getDefaultCompilerOptions, type Language } from '@vue/language-core';
import * as ts from 'typescript';
import { describe, expect, test } from 'vitest';
import plugin from '../src/reactivityAnalysisPlugin';

const source = `<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
const count = ref(0);
const doubled = computed(() => count.value * 2);
watchEffect(() => {
	console.log(doubled.value);
});
</script>

<template>{{ doubled }}</template>
`;
const countOffset = source.indexOf('const count') + 'const '.length;

describe('getReactivityAnalysis', () => {
	test('analyzes a file through the project that owns it', () => {
		const { analyze, projects } = createSession(['/a/App.vue', '/b/App.vue']);

		const a = analyze('/a/App.vue', countOffset);
		expect(a?.dependentRanges.length).toBeGreaterThan(0);

		// Same source in another project, so the same signal is expected
		expect(analyze('/b/App.vue', countOffset)).toEqual(a);
		expect(projects.get('/a/App.vue')!.requestedFileNames).not.toContain('/b/App.vue');
	});
});

function createSession(fileNames: string[]) {
	const projects = new Map(fileNames.map(fileName => [fileName, createProject(fileName)]));
	const handlers = new Map<string, (request: { arguments: unknown }) => { response: unknown }>();
	const session = {
		handlers,
		addProtocolHandler: (name: string, handler: any) => handlers.set(name, handler),
		getFileAndProject: ({ file }: { file: string }) => ({
			file,
			project: { __vue__: { language: projects.get(file)!.language } },
		}),
	};
	(plugin as any)({ typescript: ts }).create({ session });

	return {
		projects,
		analyze(fileName: string, position: number) {
			return handlers.get('_vue:getReactivityAnalysis')!({ arguments: [fileName, position] }).response as
				| { dependencyRanges: ts.TextRange[]; dependentRanges: ts.TextRange[] }
				| undefined;
		},
	};
}

// Stands in for a tsserver project: it only knows its own file, and records every file
// the reactivity analysis asks it to resolve.
function createProject(fileName: string) {
	const requestedFileNames: string[] = [];
	const scripts = new Map();
	const language: Language<string> = createLanguage<string>(
		[createVueLanguagePlugin<string>(ts, {}, getDefaultCompilerOptions(), id => id)],
		scripts,
		id => {
			requestedFileNames.push(id);
			if (id === fileName && !scripts.has(id)) {
				language.scripts.set(id, ts.ScriptSnapshot.fromString(source));
			}
		},
	);
	return { language, requestedFileNames };
}
