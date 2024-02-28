import type * as ts from 'typescript';
import type { FileRegistry } from '@vue/language-core';

export const pipeFile = process.platform === 'win32' ? '\\\\.\\pipe\\vue-tsp' : '/tmp/vue-tsp';

export const projects = new Map<ts.server.Project, [ts.server.PluginCreateInfo, FileRegistry, typeof ts]>();

export function getProject(fileName: string): [ts.server.PluginCreateInfo, FileRegistry, typeof ts] | undefined {
	for (const [project, [info, files, ts]] of projects) {
		if (project.containsFile(fileName as ts.server.NormalizedPath)) {
			return [info, files, ts];
		}
	}
}
