import { defineBuildConfig } from "unbuild";
import { fileURLToPath } from "url";
import { join } from "path";
import { readFileSync, writeFileSync } from "fs";
import { SondaRollupPlugin } from "sonda";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const languageServiceDataRE = /\/language-service\/data\/.*\.json$/;

export default defineBuildConfig([
	{
		entries: [
			{
				builder: "rollup",
				input: "src/nodeClientMain.ts",
				name: "client",
			},
			{
				builder: "rollup",
				input: "./node_modules/@vue/language-server/bin/vue-language-server.js",
				name: "server",
			},
			{
				builder: "copy",
				input: "./node_modules/@vue/language-core/schemas",
				outDir: "./dist/schemas",
			},
		],

		failOnWarn: false,

		alias: {
			// https://github.com/microsoft/vscode-emmet-helper/issues/79
			"@vscode/emmet-helper": "@vscode/emmet-helper/lib/cjs/emmetHelper.js",
		},

		rollup: {
			emitCJS: true,
			esbuild: {
				target: "ES2021",
			},
			commonjs: {
				transformMixedEsModules: true,
				exclude: [/\.json$/],
			},
			json: {
				compact: true,
				preferConst: true,
				exclude: languageServiceDataRE,
			},
			inlineDependencies: true,
		},

		outDir: "dist",

		externals: ["vscode"],

		stubOptions: {
			jiti: {
				alias: {
					vscode: join(__dirname, "vscode.js"),
				},
				sourceMaps: true,
			},
		},

		hooks: {
			"rollup:options"(_ctx, options) {
				options.plugins = [
					// Load language-service data as `JSON.parse(serialized)`
					// See https://v8.dev/blog/cost-of-javascript-2019#:~:text=A%20good%20rule%20of%20thumb%20is%20to%20apply%20this%20technique%20for%20objects%20of%2010%20kB%20or%20larger
					{
						name: 'language-service-data',
						transform: {
							order: "pre",
							handler(code: string, id: string) {
								if (languageServiceDataRE.test(id.replaceAll('\\', '/'))) {
									const serialized = JSON.stringify(JSON.parse(code)).replaceAll('\\', '\\\\').replaceAll('`', '\\`');
									return {
										code: `export default JSON.parse(\`${serialized}\`)`,
										map: { mappings: '' },
									};
								}
							}
						}
					},

					SondaRollupPlugin(),

					...options.plugins,
				];

				// Only emit CJS
				if (!Array.isArray(options.output)) throw "Unreachable";
				options.output = options.output.filter((option) => option.format === "cjs");
				if (options.output.length !== 1) throw "Unreachable";
				options.output[0].sourcemap = true;
			},

			"build:done"(ctx) {
				if (ctx.options.stub) {
					// Patch the stub file
					const stubFilePath = join(__dirname, "dist/client.cjs");
					const originalStub = readFileSync(stubFilePath, "utf-8");
					const newStub = [
						`globalThis.__VOLAR_DEV_VSCODE__ = require('vscode');`,
						`globalThis.__VOLAR_DEV_FS__ = require('node:fs');`,
						originalStub,
					].join("\n");
					writeFileSync(stubFilePath, newStub);
				}
			},
		},

		replace: {
			"globalThis.__VOLAR_DEV_FS__": "undefined",
			"process.env.NODE_ENV": "'production'",
		},
	},
]);
