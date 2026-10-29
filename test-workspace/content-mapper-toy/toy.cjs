// A template language of one element a line: `tag attrs` or `tag attrs | text`, as `<tag attrs>text</tag>`.
function toy(source) {
	let html = '';
	const mappings = [];
	let lineStart = 0;
	for (const line of source.split('\n')) {
		const start = lineStart + line.length - line.trimStart().length;
		const end = lineStart + line.trimEnd().length;
		lineStart += line.length + 1;
		if (start >= end) {
			continue;
		}
		const bar = source.indexOf(' | ', start);
		const headEnd = bar !== -1 && bar < end ? bar : end;
		const head = source.slice(start, headEnd);
		const tag = head.split(' ')[0];
		mappings.push([html.length, 0, start, 0, 0, 0]);
		html += '<';
		mappings.push([html.length, head.length, start, head.length, 0, 0]);
		html += head + '>';
		if (headEnd < end) {
			const textStart = headEnd + 3;
			mappings.push([html.length, end - textStart, textStart, end - textStart, 0, 0]);
			html += source.slice(textStart, end);
		}
		html += `</${tag}>`;
		mappings.push([html.length, 0, end, 0, 0, 0]);
	}
	return { html, mappings };
}

module.exports = { ir: { templateCompilers: { toy } } };
