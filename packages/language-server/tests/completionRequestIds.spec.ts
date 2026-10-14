import {
	type CompletionList,
	CompletionRequest,
	createProtocolConnection,
	type RequestMessage,
	type ResponseMessage,
	StreamMessageReader,
	StreamMessageWriter,
} from '@volar/language-server/node';
import { createLanguage, createLanguageService, createUriMap } from '@vue/language-service';
import { PassThrough } from 'node:stream';
import * as ts from 'typescript';
import { expect, test } from 'vitest';
import { URI } from 'vscode-uri';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(resolvePromise => resolve = resolvePromise);
	return { promise, resolve };
}

test('reuses a completed JSON-RPC request ID while another completion is pending', async () => {
	const uri = URI.parse('file:///request-ids.ts');
	const language = createLanguage<URI>([], createUriMap(false), () => {});
	language.scripts.set(uri, ts.ScriptSnapshot.fromString('value'), 'typescript');
	const pending = Array.from({ length: 3 }, () => ({
		entered: deferred<void>(),
		result: deferred<CompletionList>(),
	}));
	let call = 0;
	const service = createLanguageService(
		language,
		[{
			capabilities: { completionProvider: {} },
			create: () => ({
				provideCompletionItems() {
					const gate = pending[call++]!;
					gate.entered.resolve();
					return gate.result.promise;
				},
			}),
		}],
		{ workspaceFolders: [] },
		{},
	);
	const requests = new PassThrough();
	const responses = new PassThrough();
	const connection = createProtocolConnection(new StreamMessageReader(requests), new StreamMessageWriter(responses));
	const writer = new StreamMessageWriter(requests);
	const reader = new StreamMessageReader(responses);
	const waiting = new Map<number, ReturnType<typeof deferred<ResponseMessage>>>();
	reader.listen(message => {
		const response = message as ResponseMessage;
		waiting.get(response.id as number)!.resolve(response);
	});
	connection.onRequest(
		CompletionRequest.type,
		(params, token) =>
			service.getCompletionItems(URI.parse(params.textDocument.uri), params.position, params.context, token),
	);
	connection.listen();

	function request(id: number, triggerKind = 1) {
		const response = deferred<ResponseMessage>();
		waiting.set(id, response);
		const message: RequestMessage = {
			jsonrpc: '2.0',
			id,
			method: CompletionRequest.method,
			params: { textDocument: { uri: uri.toString() }, position: { line: 0, character: 1 }, context: { triggerKind } },
		};
		void writer.write(message);
		return response.promise;
	}
	function list(label: string): CompletionList {
		return {
			isIncomplete: false,
			items: [{ label, insertText: `${label}:one` }, { label, insertText: `${label}:two` }],
		};
	}
	try {
		const first = request(7);
		await pending[0]!.entered.promise;
		const second = request(8);
		await pending[1]!.entered.promise;
		pending[0]!.result.resolve(list('first'));
		expect(await first).toEqual({ jsonrpc: '2.0', id: 7, result: list('first') });
		// ID 7 is reusable after its response, even though ID 8 has not finished.
		const reused = request(7);
		await pending[2]!.entered.promise;
		pending[2]!.result.resolve(list('reused'));
		expect(await reused).toEqual({ jsonrpc: '2.0', id: 7, result: list('reused') });
		pending[1]!.result.resolve(list('second'));
		expect(await second).toEqual({ jsonrpc: '2.0', id: 8, result: list('second') });
		expect(await request(9, 3)).toEqual({ jsonrpc: '2.0', id: 9, result: list('reused') });
		expect(call).toBe(3);
	}
	finally {
		connection.dispose();
		reader.dispose();
		writer.dispose();
		requests.destroy();
		responses.destroy();
		service.dispose();
	}
});
