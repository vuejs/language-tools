// A Vue Content Mapper of TS 7.1 other than @vue/content-mapper: every file becomes an empty module.
let input = Buffer.alloc(0);

process.stdin.on('data', chunk => {
	input = Buffer.concat([input, chunk]);
	while (true) {
		const headerEnd = input.indexOf('\r\n\r\n');
		if (headerEnd < 0) {
			return;
		}
		const length = Number(/Content-Length:\s*(\d+)/i.exec(input.subarray(0, headerEnd).toString('ascii'))[1]);
		if (input.length < headerEnd + 4 + length) {
			return;
		}
		const message = JSON.parse(input.subarray(headerEnd + 4, headerEnd + 4 + length).toString('utf8'));
		input = input.subarray(headerEnd + 4 + length);
		if (message.id !== undefined) {
			respond(message);
		}
	}
});

function respond({ id, method }) {
	const result = method === 'initialize'
		? { positionEncoding: 'utf-16', diagnosticSource: 'stub-vue-mapper' }
		: method === 'openProject'
		? { configIdentity: 'stub' }
		: method === 'transform'
		? { text: 'export {};\n', extension: '.ts', mappings: [] }
		: null;
	const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id, result }));
	process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
	process.stdout.write(body);
}
