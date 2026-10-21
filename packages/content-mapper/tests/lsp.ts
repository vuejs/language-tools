import { type ChildProcess, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { repositoryRoot } from './utils';

interface Position {
	line: number;
	character: number;
}

interface Range {
	start: Position;
	end: Position;
}

export interface LspServer {
	request<T = any>(method: string, params: unknown): Promise<T>;
	notify(method: string, params: unknown): void;
	close(): void;
}

export function startLspServer(cwd: string): Promise<LspServer> {
	const proc: ChildProcess = spawn(
		process.execPath,
		[path.join(repositoryRoot, 'node_modules/typescript-7/bin/tsc'), '--lsp', '--stdio'],
		{ cwd, env: { ...process.env, VUE_CONTENT_MAPPER_WORKERS: '1' } },
	);
	const pending = new Map<number, (message: any) => void>();
	let buffer = Buffer.alloc(0);
	let nextId = 0;

	proc.stdout!.on('data', (chunk: Buffer) => {
		buffer = Buffer.concat([buffer, chunk]);
		while (true) {
			const headerEnd = buffer.indexOf('\r\n\r\n');
			if (headerEnd < 0) {
				return;
			}
			const length = Number(/Content-Length: (\d+)/.exec(buffer.subarray(0, headerEnd).toString())![1]);
			if (buffer.length < headerEnd + 4 + length) {
				return;
			}
			const message = JSON.parse(buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString());
			buffer = buffer.subarray(headerEnd + 4 + length);
			if (message.method === undefined) {
				pending.get(message.id)?.(message);
				pending.delete(message.id);
			}
			else if (message.id !== undefined) {
				send({
					jsonrpc: '2.0',
					id: message.id,
					result: message.method === 'workspace/configuration'
						? message.params.items.map(() => ({}))
						: null,
				});
			}
		}
	});

	function send(message: object) {
		const text = JSON.stringify(message);
		proc.stdin!.write(`Content-Length: ${Buffer.byteLength(text)}\r\n\r\n${text}`);
	}

	const server: LspServer = {
		request(method, params) {
			return new Promise((resolve, reject) => {
				const id = ++nextId;
				pending.set(id, message => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
				send({ jsonrpc: '2.0', id, method, params });
			});
		},
		notify(method, params) {
			send({ jsonrpc: '2.0', method, params });
		},
		close() {
			proc.kill();
		},
	};

	return server.request('initialize', {
		processId: process.pid,
		rootUri: pathToFileURL(cwd).href,
		capabilities: { textDocument: { rename: { prepareSupport: true } } },
		initializationOptions: { runExternalCode: true },
	}).then(() => {
		server.notify('initialized', {});
		return server;
	});
}

export class LspDocument {
	readonly uri: string;
	readonly text: string;

	constructor(readonly fileName: string) {
		this.uri = pathToFileURL(fileName).href;
		this.text = fs.readFileSync(fileName, 'utf8');
	}

	/** Compares paths, as tsgo encodes Windows drives differently (`file:///c%3A/...`) from `pathToFileURL`. */
	is(uri: string) {
		return uri.startsWith('file:') && path.relative(fileURLToPath(uri), this.fileName) === '';
	}

	open(server: LspServer) {
		server.notify('textDocument/didOpen', {
			textDocument: { uri: this.uri, languageId: 'vue', version: 1, text: this.text },
		});
	}

	/** Position of the `nth` occurrence of `search`, offset by `delta` characters. */
	at(search: string, nth = 0, delta = 0): Position {
		let offset = -1;
		for (let i = 0; i <= nth; i++) {
			offset = this.text.indexOf(search, offset + 1);
			if (offset < 0) {
				throw new Error(`"${search}" #${nth} not found in ${this.fileName}`);
			}
		}
		return this.positionAt(offset + delta);
	}

	/** `line:character text` for a range in this document. */
	describe(range: Range) {
		const start = this.offsetAt(range.start);
		const end = this.offsetAt(range.end);
		return `${range.start.line}:${range.start.character} ${this.text.slice(start, end)}`;
	}

	private positionAt(offset: number): Position {
		const lines = this.text.slice(0, offset).split('\n');
		return { line: lines.length - 1, character: lines[lines.length - 1]!.length };
	}

	private offsetAt(position: Position) {
		const lines = this.text.split('\n');
		let offset = 0;
		for (let i = 0; i < position.line; i++) {
			offset += lines[i]!.length + 1;
		}
		return offset + position.character;
	}
}
