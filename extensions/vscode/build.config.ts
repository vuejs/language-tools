import { defineBuildConfig } from "unbuild";
import { fileURLToPath } from "url";
import { join } from "path";
import { readFileSync, writeFileSync } from "fs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

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
				builder: 'copy',
				input: './node_modules/@vue/language-core/schemas',
				outDir: './dist/schemas',
			}
		],

		failOnWarn: false,

		alias: {
			// https://github.com/microsoft/vscode-emmet-helper/issues/79
			"@vscode/emmet-helper": "@vscode/emmet-helper/lib/cjs/emmetHelper.js"
		},

		rollup: {
			emitCJS: true,
			esbuild: {
				target: 'ES2021'
			},
			commonjs: {
				transformMixedEsModules: true,
				exclude: [/\.json$/],
			},
			json: {
				compact: true,
				preferConst: true,
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
			"process.env.NODE_ENV": "'production'"
		}
	}
]);
