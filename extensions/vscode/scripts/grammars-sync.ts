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
		},
		{
			'file': 'html.tmLanguage.json',
			'url': 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/html/syntaxes/html.tmLanguage.json',
		},
		{
			'file': 'javascript.tmLanguage.json',
			'url':
				'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/javascript/syntaxes/JavaScript.tmLanguage.json',
		},
		{
			'file': 'scss.tmLanguage.json',
			'url': 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/scss/syntaxes/scss.tmLanguage.json',
		},
		{
			'file': 'typescript.tmLanguage.json',
			'url':
				'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/typescript-basics/syntaxes/TypeScript.tmLanguage.json',
		},
	]
	: JSON.parse(await readFile(lockPath, 'utf8'));
if (!Array.isArray(lock)) {
	throw new Error('_lock.json must contain an array of lock items.');
}
await Promise.all(lock.map(item => processItem(dirPath, item, update)));
await mkdir(dirPath, { recursive: true });
await writeFile(lockPath, JSON.stringify(lock, null, '\t') + '\n', 'utf8');
