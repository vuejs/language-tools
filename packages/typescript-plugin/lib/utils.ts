import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as ts from 'typescript';
import type { NotificationData, ProjectInfo, RequestData, ResponseData } from './server';

export { TypeScriptProjectHost } from '@volar/typescript';

let { version } = require('../package.json');
if (version === '2.1.10') {
	version += '-dev';
}
const platform = os.platform();
const pipeDir = platform === 'win32'
	? `\\\\.\\pipe\\`
	: `/tmp/`;

export function getServerPath(kind: ts.server.ProjectKind, id: number) {
	if (kind === 1 satisfies ts.server.ProjectKind.Configured) {
		return `${pipeDir}vue-named-pipe-${version}-configured-${id}`;
	} else {
		return `${pipeDir}vue-named-pipe-${version}-inferred-${id}`;
	}
}

class NamedPipeServer {
	path: string;
	connecting = false;
	projectInfo?: ProjectInfo;
	containsFileCache = new Map<string, Promise<boolean | undefined | null>>();
	componentNamesAndProps = new Map<string, Record<string, {
		name: string;
		required?: true;
		commentMarkdown?: string;
	}[]>>();

	constructor(kind: ts.server.ProjectKind, id: number) {
		this.path = getServerPath(kind, id);
	}

	containsFile(fileName: string) {
		if (this.projectInfo) {
			if (!this.containsFileCache.has(fileName)) {
				this.containsFileCache.set(fileName, (async () => {
					const res = await this.request<boolean>('containsFile', fileName);
					if (typeof res !== 'boolean') {
						// If the request fails, delete the cache
						this.containsFileCache.delete(fileName);
					}
					return res;
				})());
			}
			return this.containsFileCache.get(fileName);
		}
	}

	update() {
		if (!this.connecting && !this.projectInfo) {
			this.connecting = true;
			this.connect();
		}
	}

	connect() {
		this.socket = net.connect(this.path);
		this.socket.on('data', this.onData.bind(this));
		this.socket.on('connect', async () => {
			const projectInfo = await this.request<ProjectInfo>('projectInfo', '');
			if (projectInfo) {
				console.log('TSServer project ready:', projectInfo.name);
				this.projectInfo = projectInfo;
				this.containsFileCache.clear();
				onServerReady.forEach(cb => cb());
			} else {
				this.close();
			}
		});
		this.socket.on('error', err => {
			if ((err as any).code === 'ECONNREFUSED') {
				try {
					console.log('Deleteing invalid named pipe file:', this.path);
					fs.promises.unlink(this.path);
				} catch { }
			}
			this.close();
		});
		this.socket.on('timeout', () => {
			this.close();
		});
	}

	close() {
		this.connecting = false;
		this.projectInfo = undefined;
		this.socket?.end();
	}

	socket?: net.Socket;
	seq = 0;
	dataChunks: Buffer[] = [];
	requestHandlers: Map<number, (res: any) => void> = new Map();

	onData(chunk: Buffer) {
		this.dataChunks.push(chunk);
		const data = Buffer.concat(this.dataChunks);
		const text = data.toString();
		if (text.endsWith('\n\n')) {
			this.dataChunks.length = 0;
			const results = text.split('\n\n');
			for (let result of results) {
				result = result.trim();
				if (!result) {
					continue;
				}
				try {
					const data: ResponseData | NotificationData = JSON.parse(result.trim());
					if (typeof data[0] === 'number') {
						const [seq, res] = data;
						this.requestHandlers.get(seq)?.(res);
					} else {
						const [type, fileName, res] = data;
						this.onNotification(type, fileName, res);
					}
				} catch (e) {
					console.error('JSON parse error:', e);
				}
			}
		}
	}

	onNotification(type: NotificationData[0], fileName: string, data: any) {
		// console.log(`[${type}] ${fileName} ${JSON.stringify(data)}`);
		if (type === 'componentAndPropsUpdated') {
			this.componentNamesAndProps.set(fileName, data);
		}
	}

	request<T>(requestType: RequestData[1], fileName: string, ...args: any[]) {
		return new Promise<T | undefined | null>(resolve => {
			const seq = this.seq++;
			// console.time(`[${seq}] ${requestType} ${fileName}`);
			this.requestHandlers.set(seq, data => {
				// console.timeEnd(`[${seq}] ${requestType} ${fileName}`);
				this.requestHandlers.delete(seq);
				resolve(data);
			});
			this.socket!.write(JSON.stringify([seq, requestType, fileName, ...args] satisfies RequestData) + '\n\n');
		});
	}
}

export const configuredServers: NamedPipeServer[] = [];
export const inferredServers: NamedPipeServer[] = [];
export const onServerReady: (() => void)[] = [];

for (let i = 0; i < 10; i++) {
	configuredServers.push(new NamedPipeServer(1 satisfies ts.server.ProjectKind.Configured, i));
	inferredServers.push(new NamedPipeServer(0 satisfies ts.server.ProjectKind.Inferred, i));
}

export async function getBestServer(fileName: string) {
	for (const server of configuredServers) {
		server.update();
	}

	let servers = (await Promise.all(
		configuredServers.map(async server => {
			const projectInfo = server.projectInfo;
			if (!projectInfo) {
				return;
			}
			const containsFile = await server.containsFile(fileName);
			if (!containsFile) {
				return;
			}
			return server;
		})
	)).filter(server => !!server);

	// Sort servers by tsconfig
	servers.sort((a, b) => sortTSConfigs(fileName, a.projectInfo!.name, b.projectInfo!.name));

	if (servers.length) {
		// Return the first server
		return servers[0];
	}

	for (const server of inferredServers) {
		server.update();
	}

	servers = (await Promise.all(
		inferredServers.map(server => {
			const projectInfo = server.projectInfo;
			if (!projectInfo) {
				return;
			}
			// Check if the file is in the project's directory
			if (path.relative(projectInfo.currentDirectory, fileName).startsWith('..')) {
				return;
			}
			return server;
		})
	)).filter(server => !!server);

	// Sort servers by directory
	servers.sort((a, b) =>
		b.projectInfo!.currentDirectory.replace(/\\/g, '/').split('/').length
		- a.projectInfo!.currentDirectory.replace(/\\/g, '/').split('/').length
	);

	if (servers.length) {
		// Return the first server
		return servers[0];
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
