import { xhr, XHRResponse, getErrorStatusDescription } from 'request-light';
import { URI as Uri } from 'vscode-uri';
import * as fs from 'fs';
import type * as json from 'vscode-json-languageservice';
import type { Connection } from 'vscode-languageserver';
import { VSCodeContentRequest } from '@volar/shared';

function getHTTPRequestService(): json.SchemaRequestService {
	return (uri: string, _encoding?: string) => {
		const headers = { 'Accept-Encoding': 'gzip, deflate' };
		return xhr({ url: uri, followRedirects: 5, headers }).then(response => {
			return response.responseText;
		}, (error: XHRResponse) => {
			return Promise.reject(error.responseText || getErrorStatusDescription(error.status) || error.toString());
		});
	};
}

function getFileRequestService(): json.SchemaRequestService {
	return (location: string, encoding?: string) => {
		return new Promise((c, e) => {
			const uri = Uri.parse(location);
			fs.readFile(uri.fsPath, encoding, (err, buf) => {
				if (err) {
					return e(err);
				}
				c(buf.toString());
			});
		});
	};
}

const http = getHTTPRequestService();
const file = getFileRequestService();

export function getSchemaRequestService(connection: Connection, handledSchemas: string[] = ['https', 'http', 'file']) {
	const builtInHandlers: { [protocol: string]: json.SchemaRequestService | undefined } = {};
	for (let protocol of handledSchemas) {
		if (protocol === 'file') {
			builtInHandlers[protocol] = file;
		} else if (protocol === 'http' || protocol === 'https') {
			builtInHandlers[protocol] = http;
		}
	}
	return (uri: string): Thenable<string> => {
		const protocol = uri.substr(0, uri.indexOf(':'));

		const builtInHandler = builtInHandlers[protocol];
		if (builtInHandler) {
			return builtInHandler(uri);
		}

		return connection.sendRequest(VSCodeContentRequest.type, uri).then(responseText => {
			return responseText;
		}, error => {
			return Promise.reject(error.message);
		});
	};
}
