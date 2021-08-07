import * as http from 'http';

export function isAvailablePort(port: number) {
	return new Promise((resolve) => {
		const server = http.createServer()
			.listen(port, () => {
				server.close();
				resolve(true);
			})
			.on('error', () => {
				resolve(false);
			});
	});
}

export async function getAvaliablePort(port: number) {
	if (!(await isAvailablePort(port))) {
		port++;
	}
	return port;
}
