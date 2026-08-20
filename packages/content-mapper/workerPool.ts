import { availableParallelism } from 'node:os';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import type {
	CloseProjectParams,
	OpenProjectParams,
	OpenProjectResult,
	TransformParams,
	TransformResult,
} from './protocol';

interface WorkerRequest {
	id: number;
	method: 'openProject' | 'closeProject' | 'transform';
	params: OpenProjectParams | CloseProjectParams | TransformParams;
}

interface WorkerResponse {
	id: number;
	result?: OpenProjectResult | TransformResult;
	error?: string;
}

interface PoolWorker {
	thread: Worker;
	pending: Map<number, {
		resolve(value: OpenProjectResult | TransformResult | undefined): void;
		reject(error: unknown): void;
	}>;
	failed: boolean;
	terminating: boolean;
	projects: Map<string, Promise<OpenProjectResult>>;
}

interface PoolProject {
	params: OpenProjectParams;
	primaryWorker: PoolWorker;
	fileWorkers: Map<string, PoolWorker>;
	configIdentity?: string;
}

const defaultWorkerCount = Math.min(4, availableParallelism());
const filesBeforeParallelism = 32;

export class TransformPool {
	readonly workerCount: number;
	#directModule: Promise<typeof import('./project.js')> | undefined;
	#nextRequestId = 0;
	#projects = new Map<string, PoolProject>();
	#workers: PoolWorker[];
	#workerPath: string;

	constructor(
		workerCount = readWorkerCount(),
		workerPath = path.resolve(__dirname, 'worker.js'),
	) {
		this.workerCount = workerCount;
		this.#workerPath = workerPath;
		this.#directModule = workerCount === 1
			? import('./project.js')
			: undefined;
		this.#workers = workerCount === 1
			? []
			: [this.#createWorker()];
	}

	async openProject(params: OpenProjectParams) {
		if (this.#directModule) {
			return (await this.#directModule).openProject(params);
		}
		if (this.#projects.has(params.projectHandle)) {
			throw new Error(`Vue content mapper project is already open: ${params.projectHandle}`);
		}
		const primaryWorker = this.#workers[0];
		if (!primaryWorker) {
			throw new Error('Vue content mapper has no available worker');
		}
		const project: PoolProject = {
			params,
			primaryWorker,
			fileWorkers: new Map(),
		};
		this.#projects.set(params.projectHandle, project);
		try {
			const result = await this.#ensureProject(primaryWorker, project);
			project.configIdentity = result.configIdentity;
			return result;
		}
		catch (error) {
			this.#projects.delete(params.projectHandle);
			throw error;
		}
	}

	async closeProject(params: CloseProjectParams) {
		if (this.#directModule) {
			(await this.#directModule).closeProject(params.projectHandle);
			return;
		}
		const project = this.#projects.get(params.projectHandle);
		this.#projects.delete(params.projectHandle);
		if (!project) {
			return;
		}
		await Promise.all(this.#workers.map(async worker => {
			const opened = worker.projects.get(params.projectHandle);
			if (!opened) {
				return;
			}
			try {
				await opened;
				await this.#request(worker, 'closeProject', params);
			}
			finally {
				worker.projects.delete(params.projectHandle);
			}
		}));
	}

	async transform(params: TransformParams) {
		if (this.#directModule) {
			return (await this.#directModule).transformVue(params);
		}
		const project = params.projectHandle
			? this.#projects.get(params.projectHandle)
			: undefined;
		if (params.projectHandle && !project) {
			throw new Error(`Unknown Vue content mapper project handle: ${params.projectHandle}`);
		}
		let worker = project?.fileWorkers.get(params.fileName);
		if (!worker) {
			worker = project
				? project.fileWorkers.size < filesBeforeParallelism
					? project.primaryWorker
					: this.#getParallelWorker(params.fileName)
				: this.#workers[0];
			if (worker && project) {
				project.fileWorkers.set(params.fileName, worker);
			}
		}
		if (!worker) {
			throw new Error('Vue content mapper has no available worker');
		}
		if (project) {
			await this.#ensureProject(worker, project);
		}
		return this.#request(worker, 'transform', params) as Promise<TransformResult>;
	}

	async close() {
		this.#projects.clear();
		await Promise.all(this.#workers.map(worker => {
			worker.terminating = true;
			this.#failWorker(worker, new Error('Vue content mapper worker pool is shutting down'));
			return worker.thread.terminate();
		}));
	}

	#createWorker(): PoolWorker {
		const thread = new Worker(this.#workerPath, {
			stdout: true,
			stderr: true,
		});
		thread.stdout.pipe(process.stderr);
		thread.stderr.pipe(process.stderr);
		const worker: PoolWorker = {
			thread,
			pending: new Map(),
			failed: false,
			terminating: false,
			projects: new Map(),
		};
		thread.on('message', (message: WorkerResponse) => {
			const request = worker.pending.get(message.id);
			if (!request) {
				return;
			}
			worker.pending.delete(message.id);
			if (message.error !== undefined) {
				request.reject(new Error(message.error));
			}
			else {
				request.resolve(message.result);
			}
		});
		thread.on('error', error => this.#failWorker(worker, error));
		thread.on('exit', code => {
			if (!worker.terminating) {
				this.#failWorker(worker, new Error(`Vue content mapper worker exited unexpectedly with code ${code}`));
			}
		});
		thread.unref();
		return worker;
	}

	#getParallelWorker(fileName: string) {
		while (this.#workers.length < this.workerCount) {
			this.#workers.push(this.#createWorker());
		}
		return this.#workers[hash(fileName) % this.#workers.length];
	}

	#ensureProject(worker: PoolWorker, project: PoolProject) {
		let opened = worker.projects.get(project.params.projectHandle);
		if (!opened) {
			opened = (this.#request(worker, 'openProject', project.params) as Promise<OpenProjectResult>)
				.then(result => {
					if (project.configIdentity && result.configIdentity !== project.configIdentity) {
						throw new Error('Vue content mapper workers produced inconsistent project configuration');
					}
					return result;
				})
				.catch(error => {
					worker.projects.delete(project.params.projectHandle);
					throw error;
				});
			worker.projects.set(project.params.projectHandle, opened);
		}
		return opened;
	}

	#request(
		worker: PoolWorker,
		method: WorkerRequest['method'],
		params: WorkerRequest['params'],
	) {
		if (worker.failed) {
			return Promise.reject(new Error('Vue content mapper worker is unavailable'));
		}
		const id = ++this.#nextRequestId;
		return new Promise<OpenProjectResult | TransformResult | undefined>((resolve, reject) => {
			worker.pending.set(id, { resolve, reject });
			try {
				worker.thread.postMessage({ id, method, params } satisfies WorkerRequest);
			}
			catch (error) {
				worker.pending.delete(id);
				reject(error);
			}
		});
	}

	#failWorker(worker: PoolWorker, error: unknown) {
		if (worker.failed) {
			return;
		}
		worker.failed = true;
		for (const request of worker.pending.values()) {
			request.reject(error);
		}
		worker.pending.clear();
	}
}

export function readWorkerCount(value = process.env.VUE_CONTENT_MAPPER_WORKERS) {
	if (value === undefined || value === 'auto') {
		return defaultWorkerCount;
	}
	const count = Number(value);
	if (!Number.isSafeInteger(count) || count < 1) {
		throw new Error(`VUE_CONTENT_MAPPER_WORKERS must be "auto" or a positive integer, received ${value}`);
	}
	return count;
}

function hash(value: string) {
	let result = 2166136261;
	for (let index = 0; index < value.length; index++) {
		result ^= value.charCodeAt(index);
		result = Math.imul(result, 16777619);
	}
	return result >>> 0;
}
