const https = require('https');
const fs = require('fs');
const path = require('path');

(async () => {

	const builtInDirectives = await fetchBuiltInDirectives();
	const builtInDirectivesJson = builtInDirectives
		.replace(/```vue-html/g, '```html')
		.split('\n##')
		.slice(1)
		.map((section) => {
			const lines = section.split('\n');
			const name = lines[0].trim().split(' ')[0];
			lines[0] = '##' + lines[0].split(' ').slice(0, -1).join(' ');
			return {
				name,
				valueSet: name === 'v-else' ? 'v' : undefined,
				description: {
					kind: 'markdown',
					value: lines.join('\n'),
				},
			};
		});

	// write json to file
	const writePath = path.resolve(__dirname, '../src/data/builtInDirectives.json');
	fs.writeFileSync(writePath, JSON.stringify(builtInDirectivesJson, null, 2));

	console.log('Built-in directives updated successfully!');
	console.log('Path: ' + writePath);
})();

// fetch markdown content from https://raw.githubusercontent.com/vuejs/docs/main/src/api/built-in-directives.md
function fetchBuiltInDirectives() {
	return new Promise((resolve, reject) => {
		https.get(
			'https://raw.githubusercontent.com/vuejs/docs/main/src/api/built-in-directives.md',
			(res) => {
				let data = ''
				res.on('data', (chunk) => {
					data += chunk
				})
				res.on('end', () => {
					resolve(data)
				})
			}
		)
	})
}
