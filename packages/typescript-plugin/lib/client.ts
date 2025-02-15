import type { RequestData } from './server';
import { getBestServer } from './utils';

export const collectExtractProps = createRequest<
	typeof import('./requests/collectExtractProps.js')['collectExtractProps']
>('collectExtractProps');

export const getImportPathForFile = createRequest<
	typeof import('./requests/getImportPathForFile.js')['getImportPathForFile']
>('getImportPathForFile');

export const getPropertiesAtLocation = createRequest<
	typeof import('./requests/getPropertiesAtLocation.js')['getPropertiesAtLocation']
>('getPropertiesAtLocation');

export const getQuickInfoAtPosition = createRequest<
	typeof import('./requests/getQuickInfoAtPosition.js')['getQuickInfoAtPosition']
>('getQuickInfoAtPosition');

// Component Infos

export async function getComponentProps(fileName: string, componentName: string) {
	const server = await getBestServer(fileName);
	if (!server) {
		return;
	}
	return await server.getComponentProps(fileName, componentName);
}

export const getComponentEvents = createRequest<
	typeof import('./requests/getComponentEvents.js')['getComponentEvents']
>('getComponentEvents');

export const getComponentDirectives = createRequest<
	typeof import('./requests/getComponentDirectives.js')['getComponentDirectives']
>('getComponentDirectives');

export async function getComponentNames(fileName: string) {
	const server = await getBestServer(fileName);
	if (!server) {
		return;
	}
	const componentAndProps = server.componentNamesAndProps.get(fileName);
	if (!componentAndProps) {
		return;
	}
	return Object.keys(componentAndProps);
}

export const getElementAttrs = createRequest<
	typeof import('./requests/getElementAttrs.js')['getElementAttrs']
>('getElementAttrs');

function createRequest<T extends (...args: any) => any>(requestType: RequestData[1]) {
	return async function (...[fileName, ...rest]: Parameters<T>) {
		const server = await getBestServer(fileName);
		if (!server) {
			return;
		}
		return server.sendRequest<ReturnType<T>>(requestType, fileName, ...rest);
	};
}
