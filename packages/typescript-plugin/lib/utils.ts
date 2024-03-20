import * as os from 'os';
import * as net from 'net';
import * as path from 'path';
import type * as ts from 'typescript';
import * as fs from 'fs';
import type { Request } from './server';

export interface NamedPipeServer {
	path: string;
	serverKind: ts.server.ProjectKind;
	currentDirectory: string;
}

const { version } = require('../package.json');

export const pipeTable = path.join(os.tmpdir(), `vue-tsp-table-${version}.json`);

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

export async function searchNamedPipeServerForFile(fileName: string) {
	if (!fs.existsSync(pipeTable)) {
		return;
	}
	const servers: NamedPipeServer[] = JSON.parse(fs.readFileSync(pipeTable, 'utf8'));
	const configuredServers = servers
		.filter(item => item.serverKind === 1 satisfies ts.server.ProjectKind.Configured);
	const inferredServers = servers
		.filter(item => item.serverKind === 0 satisfies ts.server.ProjectKind.Inferred)
		.sort((a, b) => b.currentDirectory.length - a.currentDirectory.length);
	for (const server of configuredServers) {
		const client = await connect(server.path);
		if (client) {
			const response = await sendRequestWorker<boolean>({ type: 'containsFile', args: [fileName] }, client);
			if (response) {
				return server;
			}
		}
	}
	for (const server of inferredServers) {
		if (!path.relative(server.currentDirectory, fileName).startsWith('..')) {
			const client = await connect(server.path);
			if (client) {
				return server;
			}
		}
	}
}

export function sendRequestWorker<T>(request: Request, client: net.Socket) {
	return new Promise<T | undefined | null>(resolve => {
		let dataChunks: Buffer[] = [];
		client.on('data', chunk => {
			dataChunks.push(chunk);
		});
		client.on('end', () => {
			if (!dataChunks.length) {
				console.warn('[Vue Named Pipe Client] No response from server for request:', request.type);
				resolve(undefined);
				return;
			}
			const data = Buffer.concat(dataChunks);
			const text = data.toString();
			let json = null;
			try {
				json = JSON.parse(text);
			} catch (e) {
				console.error('[Vue Named Pipe Client] Failed to parse response:', text);
				resolve(undefined);
				return;
			}
			resolve(json);
		});
		client.write(JSON.stringify(request));
	});
}
