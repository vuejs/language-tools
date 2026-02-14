// @ts-check
const { readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

generateNames();

async function generateNames() {
	const typePath = join(__dirname, '../types/template-helpers.d.ts');
	const typeText = await readFile(typePath, 'utf-8');

	/** @type {Set<string>} */
	const pascalNames = new Set();
	/** @type {Set<string>} */
	const camelNames = new Set();

	const declReg = /(?<=const\s+)\w*?(?=:)|(?<=type\s+)\w*?(?=\s*=|<)|(?<=function\s+)\w*?(?=\(|<)/g;
	const prefix = '__VLS_';

	for (const match of typeText.matchAll(declReg)) {
		const name = match[0].slice(prefix.length);
		if (name[0]?.toUpperCase() === name[0]) {
			pascalNames.add(name);
		}
		else {
			camelNames.add(name);
		}
	}

	const namesPath = join(__dirname, '../lib/codegen/names.ts');
	const namesText = await readFile(namesPath, 'utf-8');

	await writeFile(
		namesPath,
		namesText.replace(
			/(?<=\/\/ #region .*\n).*?(?=\t\/\/ #endregion)/ms,
			[...camelNames].sort().map(name => `\t${name}: '${prefix + name}',\n`).join('')
				+ '\n'
				+ [...pascalNames].sort().map(name => `\t${name}: '${prefix + name}',\n`).join(''),
		),
	);
}
