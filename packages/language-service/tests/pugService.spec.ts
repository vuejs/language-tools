import { expect, test } from 'vitest';
import { getLanguageService } from 'volar-service-pug/lib/languageService';
import * as html from 'vscode-html-languageservice';

test('the pug service scans the HTML of a pug template in pug offsets', () => {
	const pugCode = 'div#app\n  p.text hello\n';
	const pugLs = getLanguageService(html.getLanguageService());
	const scanner = pugLs.createScanner(pugLs.parsePugDocument(pugCode))!;
	const startTags: string[] = [];
	for (let type = scanner.scan(); type !== html.TokenType.EOS; type = scanner.scan()) {
		if (type === html.TokenType.StartTag) {
			startTags.push(pugCode.slice(scanner.getTokenOffset(), scanner.getTokenEnd()));
		}
	}
	expect(startTags).toEqual(['div', 'p']);
});
