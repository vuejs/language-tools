import * as fs from 'fs';
import type * as net from 'net';
import * as path from 'path';
import type * as ts from 'typescript';
import type { Request } from './server';
import type { NamedPipeServer } from './utils';
import { connect, pipeTable } from './utils';

export function collectExtractProps(
	...args: Parameters<typeof import('./requests/collectExtractProps.js')['collectExtractProps']>
) {
	return sendRequest<ReturnType<typeof import('./requests/collectExtractProps')['collectExtractProps']>>({
		type: 'collectExtractProps',
		args,
	});
}

export async function getPropertiesAtLocation(
	...args: Parameters<typeof import('./requests/getPropertiesAtLocation.js')['getPropertiesAtLocation']>
) {
	return await sendRequest<ReturnType<typeof import('./requests/getPropertiesAtLocation')['getPropertiesAtLocation']>>({
		type: 'getPropertiesAtLocation',
		args,
	});
}

export function getQuickInfoAtPosition(
	...args: Parameters<typeof import('./requests/getQuickInfoAtPosition.js')['getQuickInfoAtPosition']>
) {
	return sendRequest<ReturnType<typeof import('./requests/getQuickInfoAtPosition')['getQuickInfoAtPosition']>>({
		type: 'getQuickInfoAtPosition',
		args,
	});
}

// Component Infos

export function getComponentProps(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getComponentProps']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getComponentProps']>>({
		type: 'getComponentProps',
		args,
	});
}

export function getComponentEvents(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getComponentEvents']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getComponentEvents']>>({
		type: 'getComponentEvents',
		args,
	});
}

export function getTemplateContextProps(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getTemplateContextProps']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getTemplateContextProps']>>({
		type: 'getTemplateContextProps',
		args,
	});
}

export function getComponentNames(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getComponentNames']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getComponentNames']>>({
		type: 'getComponentNames',
		args,
	});
}

export function getElementAttrs(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getElementAttrs']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getElementAttrs']>>({
		type: 'getElementAttrs',
		args,
	});
}

async function sendRequest<T>(request: Request) {
	const connected = await connectForFile(request.args[0]);
	if (!connected) {
		console.warn('[Vue Named Pipe Client] No server found for', request.args[0]);
		return;
	}
	const [client] = connected;
	const result = await sendRequestWorker<T>(request, client);
	client.end();
	return result;
}

export async function connectForFile(fileName: string) {
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
				return [client, server] as const;
			}
		}
	}
	for (const server of inferredServers) {
		if (!path.relative(server.currentDirectory, fileName).startsWith('..')) {
			const client = await connect(server.path);
			if (client) {
				return [client, server] as const;
			}
		}
	}
}

function sendRequestWorker<T>(request: Request, client: net.Socket) {
	return new Promise<T | undefined | null>(resolve => {
		client.once('data', data => {
			const text = data.toString();
			resolve(JSON.parse(text));
		});
		client.write(JSON.stringify(request));
	});
}
