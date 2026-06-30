import { expect, test } from 'vitest';

const VENDOR_LIST: { repo: string; path: string }[] = [
	{ repo: 'microsoft/TypeScript', path: 'src/services/types.ts' },
	{ repo: 'microsoft/vscode-html-languageservice', path: 'src/services/htmlFormatter.ts' },
	{ repo: 'microsoft/vscode', path: 'extensions/css/syntaxes/css.tmLanguage.json' },
	{ repo: 'microsoft/vscode', path: 'extensions/html/syntaxes/html.tmLanguage.json' },
	{ repo: 'microsoft/vscode', path: 'extensions/javascript/syntaxes/JavaScript.tmLanguage.json' },
	{ repo: 'microsoft/vscode', path: 'extensions/scss/syntaxes/scss.tmLanguage.json' },
	{ repo: 'microsoft/vscode', path: 'extensions/typescript-basics/syntaxes/TypeScript.tmLanguage.json' },
];

test.skipIf(process.env.TEST_VENDOR !== '1')(`ensure vendor is updated`, async () => {
	const promises = VENDOR_LIST.map(async item => ({
		...item,
		commit: await retry(() => getRemoteCommit(item.repo, item.path)),
	}));
	const snapshot = await Promise.all(promises);
	expect(snapshot).toMatchSnapshot();
});

async function getRemoteCommit(repo: string, path: string): Promise<string | undefined> {
	const token = process.env.GH_TOKEN;
	console.log(`fetching${token ? ` with token` : ''}`, repo, path);
	const headers: Record<string, string> = {
		'Accept': 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
		...token && { 'Authorization': `Bearer ${token}` },
	};
	const response = await fetch(`https://api.github.com/repos/${repo}/commits?path=${path}&per_page=1`, { headers });
	const data = await response.json();
	const sha: string | undefined = data[0]?.sha;
	if (!sha) {
		throw new Error(`No commits found for ${repo}/${path}`);
	}
	return sha;
}

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
	try {
		return await fn();
	}
	catch (error) {
		if (retries > 0) {
			console.warn(`Retrying... (${retries} left)`);
			await new Promise(res => setTimeout(res, delay));
			return retry(fn, retries - 1, delay);
		}
		else {
			throw error;
		}
	}
}
