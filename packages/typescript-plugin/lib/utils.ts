import type { FileRegistry, VueCompilerOptions } from '@vue/language-core';
import * as os from 'os';
import * as net from 'net';
import * as path from 'path';
import type * as ts from 'typescript';

export interface NamedPipeServer {
	path: string;
	serverKind: ts.server.ProjectKind;
	currentDirectory: string;
}

const { version } = require('../package.json');

export const pipeTable = path.join(os.tmpdir(), `vue-tsp-table-${version}.json`);

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

export function connect(path: string) {
	return new Promise<net.Socket | undefined>(resolve => {
		const client = net.connect(path);
		client.on('connect', () => {
			resolve(client);
		});
		client.on('error', () => {
			return resolve(undefined);
		});
	});
}
