import * as CompilerDOM from '@vue/compiler-dom';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import * as languageCore from '../index';
import { createIRPipeline } from '../lib/ir/irPipeline';
import { getDefaultCompilerOptions } from '../lib/options/compilerOptions';
import { legacyPluginMessage } from '../lib/options/plugins';
import { ts } from './typescript';

/**
 * The template language plugins of v3 that are published or public, as they are, to show that they fail to load:
 * - NMBL: `@nmbl-lang/vue-language-plugin@0.2.0` from npm, `dist/index.cjs` is `module.exports = plugin`, a function
 *   that returns `{ version: 2.1, … }`.
 * - Fumi: `packages/volar/index.ts` of Subwaytime/fumi at the commit below, which is not published, bundled with its
 *   workspace `@fumi/core` as it is; it is `export = plugin`, a function that returns `{ version: 2.2, … }`.
 */
const nmbl = '@nmbl-lang/vue-language-plugin@0.2.0';
const fumiRepository = 'https://github.com/Subwaytime/fumi.git';
const fumiCommit = '4e2fcb01ab44f2935f558dddf62130e70a1316db';

const cacheDir = path.join(os.tmpdir(), `vue-language-core-legacy-plugins-${fumiCommit.slice(0, 8)}`);
const loaded: Record<'nmbl' | 'fumi', unknown> = { nmbl: undefined, fumi: undefined };

beforeAll(async () => {
	const fumiBundle = path.join(cacheDir, 'fumi-volar.cjs');
	if (!fs.existsSync(fumiBundle)) {
		fs.rmSync(cacheDir, { recursive: true, force: true });
		fs.mkdirSync(cacheDir, { recursive: true });
		// `@volar/source-map` is the dependency of Fumi that its workspace does not provide
		execFileSync(
			'npm',
			[
				'install',
				'--prefix',
				cacheDir,
				nmbl,
				'@volar/source-map@2.4',
				'--no-save',
				'--no-package-lock',
				'--legacy-peer-deps',
				'--ignore-scripts',
				'--no-audit',
				'--no-fund',
			],
			{ stdio: 'ignore', shell: process.platform === 'win32' },
		);
		const fumiDir = path.join(cacheDir, 'fumi');
		fs.mkdirSync(fumiDir);
		for (
			const args of [
				['init', '-q'],
				['fetch', '-q', '--depth', '1', fumiRepository, fumiCommit],
				['checkout', '-q', 'FETCH_HEAD'],
			]
		) {
			execFileSync('git', args, { cwd: fumiDir, stdio: 'ignore' });
		}
		const rolldown: { build(options: object): Promise<{ output: [{ code: string }] }> } = createRequire(
			path.join(__dirname, '../../../extensions/vscode/package.json'),
		)('rolldown');
		const { output } = await rolldown.build({
			input: path.join(fumiDir, 'packages/volar/index.ts'),
			resolve: { alias: { '@fumi/core': path.join(fumiDir, 'packages/core/index.ts') } },
			external: [/^@volar\//, /^@vue\//],
			write: false,
			output: { format: 'cjs' },
			logLevel: 'silent',
		});
		fs.writeFileSync(fumiBundle, output[0].code);
	}
	loaded.nmbl = require(path.join(cacheDir, 'node_modules/@nmbl-lang/vue-language-plugin'));
	loaded.fumi = require(fumiBundle);
}, 300_000);

function pipelineOf(name: string, module: unknown) {
	return createIRPipeline(ts, {
		...getDefaultCompilerOptions(),
		plugins: [{ name, file: `/project/node_modules/${name}/index.js`, config: {}, module }],
	});
}

describe.each(['nmbl', 'fumi'] as const)('the v3 plugin of %s', lang => {
	it('is a function at the module root, and fails to load', () => {
		expect(typeof loaded[lang]).toBe('function');
		const pipeline = pipelineOf(lang, loaded[lang]);
		expect(pipeline.errors).toEqual([{ plugin: lang, message: legacyPluginMessage }]);
		expect(pipeline.compileTemplate(lang, 'div', {})).toBeUndefined();
	});

	it('returns, created as v3 did, an object with a version that fails to load', () => {
		const vueCompilerOptions = getDefaultCompilerOptions();
		const created = (loaded[lang] as (ctx: object) => object)({
			modules: { typescript: ts, '@vue/compiler-dom': CompilerDOM, '@vue/language-core': languageCore },
			compilerOptions: {},
			vueCompilerOptions,
			config: {},
		});
		expect(created).toHaveProperty('version');
		const pipeline = pipelineOf(lang, created);
		expect(pipeline.errors).toEqual([{ plugin: lang, message: legacyPluginMessage }]);
		expect(pipeline.compileTemplate(lang, 'div', {})).toBeUndefined();
	});
});
