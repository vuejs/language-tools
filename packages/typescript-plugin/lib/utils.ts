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

const pipeTableFile = path.join(os.tmpdir(), `vue-tsp-table-${version}.json`);

export function readPipeTable() {
	if (!fs.existsSync(pipeTableFile)) {
		return [];
	}
	try {
		const servers: NamedPipeServer[] = JSON.parse(fs.readFileSync(pipeTableFile, 'utf8'));
		return servers;
	} catch {
		fs.unlinkSync(pipeTableFile);
		return [];
	}
}

export function updatePipeTable(servers: NamedPipeServer[]) {
	if (servers.length === 0) {
		fs.unlinkSync(pipeTableFile);
	}
	else {
		fs.writeFileSync(pipeTableFile, JSON.stringify(servers, undefined, 2));
	}
}

export function connect(path: string) {
	return new Promise<net.Socket | undefined>(resolve => {
		const client = net.connect(path);
		client.setTimeout(1000);
		client.on('connect', () => {
			resolve(client);
		});
		client.on('error', () => {
			return resolve(undefined);
		});
		client.on('timeout', () => {
			return resolve(undefined);
		});
	});
}

export async function searchNamedPipeServerForFile(fileName: string) {
	const servers = readPipeTable();
	const configuredServers = servers
		.filter(item => item.serverKind === 1 satisfies ts.server.ProjectKind.Configured);
	const inferredServers = servers
		.filter(item => item.serverKind === 0 satisfies ts.server.ProjectKind.Inferred)
		.sort((a, b) => b.currentDirectory.length - a.currentDirectory.length);
	for (const server of configuredServers.sort((a, b) => sortTSConfigs(fileName, a.currentDirectory, b.currentDirectory))) {
		const client = await connect(server.path);
		if (client) {
			const projectInfo = await sendRequestWorker<{ name: string; kind: ts.server.ProjectKind; }>({ type: 'projectInfoForFile', args: [fileName] }, client);
			if (projectInfo) {
				return {
					server,
					projectInfo,
				};
			}
		}
	}
	for (const server of inferredServers) {
		if (!path.relative(server.currentDirectory, fileName).startsWith('..')) {
			const client = await connect(server.path);
			if (client) {
				return {
					server,
					projectInfo: undefined,
				};
			}
		}
	}
}

function sortTSConfigs(file: string, a: string, b: string) {

	const inA = isFileInDir(file, path.dirname(a));
	const inB = isFileInDir(file, path.dirname(b));

	if (inA !== inB) {
		const aWeight = inA ? 1 : 0;
		const bWeight = inB ? 1 : 0;
		return bWeight - aWeight;
	}

	const aLength = a.split('/').length;
	const bLength = b.split('/').length;

	return bLength - aLength;
}

function isFileInDir(fileName: string, dir: string) {
	const relative = path.relative(dir, fileName);
	return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function sendRequestWorker<T>(request: Request, client: net.Socket) {
	return new Promise<T | undefined | null>(resolve => {
		let dataChunks: Buffer[] = [];
		client.setTimeout(5000);
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
		client.on('error', err => {
			console.error('[Vue Named Pipe Client] Error:', err.message);
			resolve(undefined);
		});
		client.on('timeout', () => {
			console.error('[Vue Named Pipe Client] Timeout');
			resolve(undefined);
		});
		client.write(JSON.stringify(request));
	});
}
