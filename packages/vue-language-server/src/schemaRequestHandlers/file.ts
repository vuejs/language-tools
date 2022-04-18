import * as fs from 'fs';
import { URI } from 'vscode-uri';

export default function handler(uri: string, encoding?: BufferEncoding): Promise<string> {
	return new Promise((resolve, reject) => {
		fs.readFile(URI.parse(uri).fsPath, { encoding }, (err, buf) => {
			err ? reject(err) : resolve(buf.toString());
		});
	});
}
