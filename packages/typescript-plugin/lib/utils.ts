import type { FileRegistry, VueCompilerOptions } from '@vue/language-core';
import * as os from 'os';
import * as path from 'path';
import type * as ts from 'typescript';

export interface PipeTable {
	[pid: string]: {
		pid: number;
		pipeFile: string;
		serverKind: ts.server.ProjectKind;
	};
}

export const pipeTable = path.join(os.tmpdir(), 'vue-tsp-table.json');

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
