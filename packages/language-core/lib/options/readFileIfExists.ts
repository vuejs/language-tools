import * as fs from 'node:fs';

/** The text of a file without its byte order mark, or `undefined` if it cannot be read. */
export function readFileIfExists(fileName: string) {
	try {
		return fs.readFileSync(fileName, 'utf8').replace(/^\uFEFF/, '');
	}
	catch {}
}
