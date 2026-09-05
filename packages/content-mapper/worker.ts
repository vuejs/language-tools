import { parentPort } from 'node:worker_threads';
import { closeProject, openProject, transformVue } from './project';
import type { CloseProjectParams, OpenProjectParams, TransformParams } from './protocol';

if (!parentPort) {
	throw new Error('Vue content mapper worker requires a parent port');
}

parentPort.on('message', ({ id, method, params }) => {
	try {
		const result = method === 'openProject'
			? openProject(params as OpenProjectParams)
			: method === 'closeProject'
			? closeProject((params as CloseProjectParams).projectHandle)
			: transformVue(params as TransformParams);
		parentPort!.postMessage({ id, result });
	}
	catch (error) {
		parentPort!.postMessage({
			id,
			error: error instanceof Error ? error.message : String(error),
		});
	}
});
