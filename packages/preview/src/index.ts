import * as WebSocket from 'ws';

export function createPreviewConnection(options: {
	onGotoCode: (fileName: string, range: [number, number], cancelToken: { readonly isCancelled: boolean; }) => void,
	getFileHref: (fileName: string, range: [number, number]) => string,
}) {

	const wsList: WebSocket.WebSocket[] = [];
	let wss: WebSocket.Server | undefined;
	let goToTemplateReq = 0;

	wss = new WebSocket.Server({ port: 56789 });
	wss.on('connection', ws => {

		wsList.push(ws);

		ws.on('message', msg => {

			const message = JSON.parse(msg.toString());

			if (message.command === 'goToTemplate') {

				const req = ++goToTemplateReq;
				const data = message.data as {
					fileName: string,
					range: [number, number],
				};
				const token = {
					get isCancelled() {
						return req !== goToTemplateReq;
					}
				};

				options.onGotoCode(data.fileName, data.range, token);
			}

			if (message.command === 'requestOpenFile') {

				const data = message.data as {
					fileName: string,
					range: [number, number],
				};
				const url = options.getFileHref(data.fileName, data.range);

				ws.send(JSON.stringify({
					command: 'openFile',
					data: url,
				}));
			}
		});
	});

	return {
		stop,
		highlight,
		unhighlight,
	};

	function stop() {
		wss?.close();
		wsList.length = 0;
	}

	function highlight(fileName: string, ranges: { start: number, end: number; }[], isDirty: boolean) {
		const msg = {
			command: 'highlightSelections',
			data: {
				fileName,
				ranges,
				isDirty,
			},
		};
		for (const ws of wsList) {
			ws.send(JSON.stringify(msg));
		}
	}

	function unhighlight() {
		const msg = {
			command: 'highlightSelections',
			data: undefined,
		};
		for (const ws of wsList) {
			ws.send(JSON.stringify(msg));
		}
	}
}
