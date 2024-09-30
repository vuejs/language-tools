import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import type * as ts from 'typescript';
import type { ProjectInfo, Request } from './server';

export { TypeScriptProjectHost } from '@volar/typescript';

const { version } = require('../package.json');
const platform = os.platform();
const pipeDir = platform === 'win32'
	? `\\\\.\\pipe`
	: `/tmp`;
const toFullPath = (file: string) => {
	if (platform === 'win32') {
		return pipeDir + '\\' + file;
	}
	else {
		return pipeDir + '/' + file;
	}
};
const configuredNamedPipePathPrefix = toFullPath(`vue-named-pipe-${version}-configured-`);
const inferredNamedPipePathPrefix = toFullPath(`vue-named-pipe-${version}-inferred-`);
const pipes = new Map<string, 'unknown' | 'ready'>();

export const onSomePipeReadyCallbacks: (() => void)[] = [];

function waitingForNamedPipeServerReady(namedPipePath: string) {
	const socket = net.connect(namedPipePath);
	const start = Date.now();
	socket.on('connect', () => {
		console.log('[Vue Named Pipe Client] Connected:', namedPipePath, 'in', (Date.now() - start) + 'ms');
		socket.write('ping');
	});
	socket.on('data', () => {
		console.log('[Vue Named Pipe Client] Ready:', namedPipePath, 'in', (Date.now() - start) + 'ms');
		pipes.set(namedPipePath, 'ready');
		socket.end();
		onSomePipeReadyCallbacks.forEach(cb => cb());
	});
	socket.on('error', err => {
		if ((err as any).code === 'ECONNREFUSED') {
			try {
				console.log('[Vue Named Pipe Client] Deleting:', namedPipePath);
				fs.promises.unlink(namedPipePath);
			} catch { }
		}
		pipes.delete(namedPipePath);
		socket.end();
	});
	socket.on('timeout', () => {
		pipes.delete(namedPipePath);
		socket.end();
	});
}

export function getNamedPipePath(projectKind: ts.server.ProjectKind.Configured | ts.server.ProjectKind.Inferred, key: number) {
	return projectKind === 1 satisfies ts.server.ProjectKind.Configured
		? `${configuredNamedPipePathPrefix}${key}`
		: `${inferredNamedPipePathPrefix}${key}`;
}

export function getReadyNamedPipePaths() {
	const configuredPipes: string[] = [];
	const inferredPipes: string[] = [];
	for (let i = 0; i < 20; i++) {
		const configuredPipe = getNamedPipePath(1 satisfies ts.server.ProjectKind.Configured, i);
		const inferredPipe = getNamedPipePath(0 satisfies ts.server.ProjectKind.Inferred, i);
		if (pipes.get(configuredPipe) === 'ready') {
			configuredPipes.push(configuredPipe);
		}
		else if (!pipes.has(configuredPipe)) {
			pipes.set(configuredPipe, 'unknown');
			waitingForNamedPipeServerReady(configuredPipe);
		}
		if (pipes.get(inferredPipe) === 'ready') {
			inferredPipes.push(inferredPipe);
		}
		else if (!pipes.has(inferredPipe)) {
			pipes.set(inferredPipe, 'unknown');
			waitingForNamedPipeServerReady(inferredPipe);
		}
	}
	return {
		configured: configuredPipes,
		inferred: inferredPipes,
	};
}

export function connect(namedPipePath: string, timeout?: number) {
	return new Promise<net.Socket | 'error' | 'timeout'>(resolve => {
		const socket = net.connect(namedPipePath);
		if (timeout) {
			socket.setTimeout(timeout);
		}
		const onConnect = () => {
			cleanup();
			resolve(socket);
		};
		const onError = (err: any) => {
			if ((err as any).code === 'ECONNREFUSED') {
				try {
					console.log('[Vue Named Pipe Client] Deleting:', namedPipePath);
					fs.promises.unlink(namedPipePath);
				} catch { }
			}
			pipes.delete(namedPipePath);
			cleanup();
			resolve('error');
			socket.end();
		};
		const onTimeout = () => {
			cleanup();
			resolve('timeout');
			socket.end();
		};
		const cleanup = () => {
			socket.off('connect', onConnect);
			socket.off('error', onError);
			socket.off('timeout', onTimeout);
		};
		socket.on('connect', onConnect);
		socket.on('error', onError);
		socket.on('timeout', onTimeout);
	});
}

export async function searchNamedPipeServerForFile(fileName: string) {
	const paths = await getReadyNamedPipePaths();

	const configuredServers = (await Promise.all(
		paths.configured.map(async path => {
			// Find existing servers
			const socket = await connect(path);
			if (typeof socket !== 'object') {
				return;
			}

			// Find servers containing the current file
			const containsFile = await sendRequestWorker<boolean>({ type: 'containsFile' satisfies Request['type'], args: [fileName] }, socket);
			if (!containsFile) {
				socket.end();
				return;
			}

			// Get project info for each server
			const projectInfo = await sendRequestWorker<ProjectInfo>({ type: 'projectInfo' satisfies Request['type'], args: [fileName] }, socket);
			if (!projectInfo) {
				socket.end();
				return;
			}

			return {
				socket,
				projectInfo,
			};
		})
	)).filter(server => !!server);

	// Sort servers by tsconfig
	configuredServers.sort((a, b) => sortTSConfigs(fileName, a.projectInfo.name, b.projectInfo.name));

	if (configuredServers.length) {
		// Close all but the first server
		for (let i = 1; i < configuredServers.length; i++) {
			configuredServers[i].socket.end();
		}
		// Return the first server
		return configuredServers[0];
	}

	const inferredServers = (await Promise.all(
		paths.inferred.map(async namedPipePath => {
			// Find existing servers
			const socket = await connect(namedPipePath);
			if (typeof socket !== 'object') {
				return;
			}

			// Get project info for each server
			const projectInfo = await sendRequestWorker<ProjectInfo>({ type: 'projectInfo' satisfies Request['type'], args: [fileName] }, socket);
			if (!projectInfo) {
				socket.end();
				return;
			}

			// Check if the file is in the project's directory
			if (!path.relative(projectInfo.currentDirectory, fileName).startsWith('..')) {
				return {
					socket,
					projectInfo,
				};
			}
		})
	)).filter(server => !!server);

	// Sort servers by directory
	inferredServers.sort((a, b) =>
		b.projectInfo.currentDirectory.replace(/\\/g, '/').split('/').length
		- a.projectInfo.currentDirectory.replace(/\\/g, '/').split('/').length
	);

	if (inferredServers.length) {
		// Close all but the first server
		for (let i = 1; i < inferredServers.length; i++) {
			inferredServers[i].socket.end();
		}
		// Return the first server
		return inferredServers[0];
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

export function sendRequestWorker<T>(request: Request, socket: net.Socket) {
	return new Promise<T | undefined | null>(resolve => {
		let dataChunks: Buffer[] = [];
		const onData = (chunk: Buffer) => {
			dataChunks.push(chunk);
			const data = Buffer.concat(dataChunks);
			const text = data.toString();
			if (text.endsWith('\n\n')) {
				let json = null;
				try {
					json = JSON.parse(text);
				} catch (e) {
					console.error('[Vue Named Pipe Client] Failed to parse response:', text);
				}
				cleanup();
				resolve(json);
			}
		};
		const onError = (err: any) => {
			console.error('[Vue Named Pipe Client] Error:', err.message);
			cleanup();
			resolve(undefined);
		};
		const cleanup = () => {
			socket.off('data', onData);
			socket.off('error', onError);
		};
		socket.on('data', onData);
		socket.on('error', onError);
		socket.write(JSON.stringify(request));
	});
}
