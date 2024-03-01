import type * as ts from 'typescript';
import type { FileRegistry, VueCompilerOptions } from '@vue/language-core';

export const pipeFile = process.platform === 'win32' ? '\\\\.\\pipe\\vue-tsp' : '/tmp/vue-tsp';

export const projects = new Map<ts.server.Project, {
	info: ts.server.PluginCreateInfo;
	files: FileRegistry;
	ts: typeof ts;
	vueOptions: VueCompilerOptions;
}>();

export function getProject(fileName: string) {
	for (const [project, data] of projects) {
		if (project.containsFile(fileName as ts.server.NormalizedPath)) {
			return data;
		}
	}
}
