import { getUnusedExpectErrorMessage } from './localization';
import type {
	CloseProjectParams,
	InitializeParams,
	InitializeResult,
	OpenProjectParams,
	PositionEncoding,
	TransformParams,
	TransformResult,
} from './protocol';
import { TransformPool } from './workerPool';

interface RequestMessage {
	jsonrpc: '2.0';
	id: number | string;
	method: string;
	params: unknown;
}

let input = Buffer.alloc(0);
const workerPath = readArgument('worker');
const typescriptPath = readArgument('typescript');
if (typescriptPath) {
	process.env.VUE_CONTENT_MAPPER_TYPESCRIPT = typescriptPath;
}
const transformPool = new TransformPool(undefined, workerPath);
let unusedExpectErrorMessage = "Unused '@ts-expect-error' directive.";

console.log =
	console.info =
	console.warn =
	console.debug =
		(...args: unknown[]) => console.error(...args);

process.stdin.on('data', chunk => {
	input = Buffer.concat([input, typeof chunk === 'string' ? Buffer.from(chunk) : chunk]);
	readMessages();
});
process.stdin.on('error', fail);
process.stdin.on('end', () => {
	void transformPool.close();
});

function readMessages() {
	while (true) {
		const headerEnd = input.indexOf('\r\n\r\n');
		if (headerEnd < 0) {
			return;
		}

		const header = input.subarray(0, headerEnd).toString('ascii');
		const lengthMatch = /^Content-Length:\s*(\d+)$/im.exec(header);
		if (!lengthMatch?.[1]) {
			fail(new Error('Missing Content-Length header'));
			return;
		}

		const contentLength = Number(lengthMatch[1]);
		const messageStart = headerEnd + 4;
		const messageEnd = messageStart + contentLength;
		if (input.length < messageEnd) {
			return;
		}

		const message = JSON.parse(input.subarray(messageStart, messageEnd).toString('utf8')) as RequestMessage;
		input = input.subarray(messageEnd);
		void handleMessage(message);
	}
}

async function handleMessage(message: RequestMessage) {
	try {
		const result = message.method === 'initialize'
			? initialize(message.params as InitializeParams)
			: message.method === 'openProject'
			? await transformPool.openProject(message.params as OpenProjectParams)
			: message.method === 'closeProject'
			? await transformPool.closeProject(message.params as CloseProjectParams)
			: message.method === 'transform'
			? localizeDiagnosticDirectives(
				await transformPool.transform(message.params as TransformParams),
			)
			: undefined;
		if (result === undefined && message.method !== 'closeProject') {
			writeMessage({
				jsonrpc: '2.0',
				id: message.id,
				error: { code: -32601, message: `Unknown method ${message.method}` },
			});
			return;
		}
		writeMessage({ jsonrpc: '2.0', id: message.id, result: result ?? null });
	}
	catch (error) {
		writeMessage({
			jsonrpc: '2.0',
			id: message.id,
			error: {
				code: -32603,
				message: error instanceof Error ? error.message : String(error),
			},
		});
	}
}

function initialize(params: InitializeParams): InitializeResult {
	unusedExpectErrorMessage = getUnusedExpectErrorMessage(params.locale, typescriptPath);
	return {
		positionEncoding: selectPositionEncoding(params.positionEncodings),
		diagnosticSource: 'vue',
	};
}

function localizeDiagnosticDirectives(result: TransformResult) {
	for (const diagnostic of result.diagnosticDirectives?.unusedExpectDirectiveDiagnostics ?? []) {
		diagnostic.messageText = unusedExpectErrorMessage;
	}
	return result;
}

function selectPositionEncoding(encodings: PositionEncoding[]): PositionEncoding {
	if (encodings.includes('utf-16')) {
		return 'utf-16';
	}
	throw new Error('Vue content mapper requires UTF-16 position encoding');
}

function writeMessage(message: unknown) {
	const body = Buffer.from(JSON.stringify(message));
	process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
	process.stdout.write(body);
}

function fail(error: unknown) {
	console.error(error);
	process.exitCode = 1;
}

function readArgument(name: string) {
	const prefix = `--${name}=`;
	const argument = process.argv.find(argument => argument.startsWith(prefix));
	return argument?.slice(prefix.length);
}
