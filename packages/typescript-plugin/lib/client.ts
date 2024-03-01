import * as net from 'net';
import * as fs from 'fs';
import type * as ts from 'typescript';
import type { Request } from './server';
import type { PipeTable } from './utils';
import { pipeTable } from './utils';

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
	const pipeFile = await getPipeFile(request.args[0]);
	if (!pipeFile) {
		console.error('[Vue Named Pipe Client] pipeFile not found');
		return;
	}
	return await _sendRequest<T>(request, pipeFile);
}

async function getPipeFile(fileName: string) {
	if (fs.existsSync(pipeTable)) {
		const table: PipeTable = JSON.parse(fs.readFileSync(pipeTable, 'utf8'));
		const all = Object.values(table);
		const configuredServers = all
			.filter(item => item.serverKind === 1 satisfies ts.server.ProjectKind.Configured)
			.sort((a, b) => Math.abs(process.pid - a.pid) - Math.abs(process.pid - b.pid));
		const inferredServers = all
			.filter(item => item.serverKind === 0 satisfies ts.server.ProjectKind.Inferred)
			.sort((a, b) => Math.abs(process.pid - a.pid) - Math.abs(process.pid - b.pid));
		for (const server of configuredServers) {
			const response = await _sendRequest<boolean>({ type: 'containsFile', args: [fileName] }, server.pipeFile);
			if (response) {
				return server.pipeFile;
			}
		}
		for (const server of inferredServers) {
			const response = await _sendRequest<boolean>({ type: 'containsFile', args: [fileName] }, server.pipeFile);
			if (typeof response === 'boolean') {
				return server.pipeFile;
			}
		}
	}
}

function _sendRequest<T>(request: Request, pipeFile: string) {
	return new Promise<T | undefined | null>(resolve => {
		try {
			const client = net.connect(pipeFile);
			client.on('connect', () => {
				client.write(JSON.stringify(request));
			});
			client.on('data', data => {
				const text = data.toString();
				resolve(JSON.parse(text));
				client.end();
			});
			client.on('error', err => {
				console.error('[Vue Named Pipe Client]', err);
				return resolve(undefined);
			});
		} catch (e) {
			console.error('[Vue Named Pipe Client]', e);
			return resolve(undefined);
		}
	});
}
