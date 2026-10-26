/**
 * The text put before a pug template so that it parses. Pug reads an indented first line as an error, so an
 * indented template is parsed as the children of a `template` tag.
 */
export function getPugTemplatePrefix(content: string) {
	return calculateMinIndent(content) === 0 ? '' : 'template\n';
}

function calculateMinIndent(s: string) {
	const lines = s.split('\n');
	const minIndent = lines.reduce(function(minIndent, line) {
		if (line.trim() === '') {
			return minIndent;
		}
		const indent = line.match(/^\s*/)?.[0]?.length || 0;
		return Math.min(indent, minIndent);
	}, Infinity);
	return minIndent;
}
