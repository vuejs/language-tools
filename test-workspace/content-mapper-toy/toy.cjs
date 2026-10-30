// A template language of one element a line: `tag attrs` or `tag attrs | text`, as `<tag attrs>text</tag>`.
function toy(source) {
	const pieces = [];
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
		const tag = source.slice(start, headEnd).split(' ')[0];
		pieces.push({ start, end: start }, '<', { start, end: headEnd }, '>');
		if (headEnd < end) {
			pieces.push({ start: headEnd + 3, end });
		}
		pieces.push(`</${tag}>`, { start: end, end });
	}
	return { pieces };
}

module.exports = { ir: { templateCompilers: { toy } } };
