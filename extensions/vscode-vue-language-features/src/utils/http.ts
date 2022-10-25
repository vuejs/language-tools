import * as http from 'http';

export function isLocalHostPortUsing(port: number) {
	return new Promise<boolean>(resolve => {
		http.get(`http://localhost:${port}/`, {
			headers: {
				accept: "*/*", // if not set, always get 404 from vite server
			},
		}, res => {
			resolve(res.statusCode === 200);
		}).on('error', () => resolve(false)).end();
	});
}

export async function getLocalHostAvailablePort(port: number) {
	if (await isLocalHostPortUsing(port)) {
		port++;
	}
	return port;
}
