import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

interface LockItem {
	file: string;
	url: string;
	checksum?: string;
}

const CHECKSUM_PREFIX = 'sha256-';

function computeChecksum(content: string | Buffer): string {
	const buffer = typeof content === 'string' ? Buffer.from(content) : content;
	return CHECKSUM_PREFIX + createHash('sha256').update(buffer).digest('hex');
}

async function fetchWithChecksum(url: string) {
	console.log(`Downloading ${url}...`);
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
	}
	const content = await res.text();
	return { content, checksum: computeChecksum(content) };
}

async function fileChecksum(filePath: string): Promise<string | null> {
	if (!fs.existsSync(filePath)) {
		return null;
	}
	const content = await readFile(filePath);
	return computeChecksum(content);
}

async function safeWriteFile(filePath: string, content: string | Buffer) {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, content);
}

async function processItem(dirPath: string, item: LockItem, update: boolean): Promise<boolean> {
	if (!item.file || !item.url) {
		throw new Error('Lock item must include "file" and "url".');
	}

	const filePath = path.resolve(dirPath, item.file);

	if (update || !item.checksum) {
		const { content, checksum } = await fetchWithChecksum(item.url);
		await safeWriteFile(filePath, content);
		const changed = item.checksum !== checksum;
		item.checksum = checksum;
		return changed || update;
	}

	const expected = item.checksum;
	const localChecksum = await fileChecksum(filePath);
	if (localChecksum === expected) {
		return false;
	}

	const { content, checksum } = await fetchWithChecksum(item.url);
	if (checksum !== expected) {
		throw new Error(
			`Checksum mismatch for ${item.file}. Expected ${expected}, got ${checksum}.
Please run "pnpm test:prepare -u" to update the lock hash.`,
		);
	}

	if (checksum !== localChecksum) {
		await safeWriteFile(filePath, content);
	}

	return false;
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const dirPath = path.resolve(dir, '../tests/embeddedGrammars');
const lockPath = path.resolve(dirPath, '_lock.json');
const update = !fs.existsSync(lockPath);
const lock: LockItem[] = update
	? [
		{
			'file': 'css.tmLanguage.json',
			'url': 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/css/syntaxes/css.tmLanguage.json',
			'checksum': 'sha256-bcc97d1a3a6bf112f72d8bdb58bc438eb68aa0e070b94d00c6064b75f5cab69b',
		},
		{
			'file': 'html.tmLanguage.json',
			'url': 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/html/syntaxes/html.tmLanguage.json',
			'checksum': 'sha256-80dedf4fb27e88889ac8fb72763954a6d2660502c686f4415208d8c8d00352cd',
		},
		{
			'file': 'javascript.tmLanguage.json',
			'url':
				'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/javascript/syntaxes/JavaScript.tmLanguage.json',
			'checksum': 'sha256-db6f17f15bc4f5e860a3b8fa6055a69720a53df845c8d5121cdc4f128c16291f',
		},
		{
			'file': 'scss.tmLanguage.json',
			'url': 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/scss/syntaxes/scss.tmLanguage.json',
			'checksum': 'sha256-8f2824a80a7c6fd558fc538ec52d0a7a42a4d7ecb7ddf20d79f0d1f00fa6602b',
		},
		{
			'file': 'typescript.tmLanguage.json',
			'url':
				'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/typescript-basics/syntaxes/TypeScript.tmLanguage.json',
			'checksum': 'sha256-4e92e0d7de560217d6c8d3236d85e6e17a5d77825b15729a230c761743122661',
		},
	]
	: JSON.parse(await readFile(lockPath, 'utf8'));
if (!Array.isArray(lock)) {
	throw new Error('_lock.json must contain an array of lock items.');
}
await Promise.all(lock.map(item => processItem(dirPath, item, update)));
await mkdir(dirPath, { recursive: true });
await writeFile(lockPath, JSON.stringify(lock, null, '\t') + '\n', 'utf8');
