import { defineBuildConfig } from "unbuild";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineBuildConfig([
	// {
	//   entries: [
	//     {
	//       builder: "rollup",
	//       input: "src/nodeClientMain.ts",
	//       name: "client",
	//     },
	//   ],

	//   outDir: "dist",

	//   externals: ["vscode"],

	//   rollup: {
	//     emitCJS: true,
	//   },

	//   stubOptions: {
	//     jiti: {
	//       nativeModules: ["typescript", "vscode"],
	//       alias: {
	//         vscode: join(__dirname, "vscode.js"),
	//       },
	//     },
	//   },

	//   hooks: {
	//     "build:done"(ctx) {
	//       if (ctx.options.stub) {
	//         // Patch the stub file
	//         const stubFilePath = join(__dirname, "dist/client.cjs");
	//         const originalStub = readFileSync(stubFilePath, "utf-8");
	//         const newStub = [
	//           `globalThis.__VOLAR_DEV_VSCODE__ = require('vscode');`,
	//           `globalThis.__VOLAR_DEV_FS__ = require('node:fs');`,
	//           originalStub,
	//         ].join("\n");
	//         writeFileSync(stubFilePath, newStub);
	//       }
	//     },
	//   },
	// },
	{
		entries: [
			{
				builder: "rollup",
				input: "./node_modules/@vue/language-server/node.ts",
				name: "server",
			},
			{
				builder: 'copy',
				input: './node_modules/@vue/language-core/schemas',
				outDir: './dist/schemas',
			}
		],

		rollup: {
			emitCJS: true,
			esbuild: {
				minify: true,
			},
		},


		externals: [],

		// hooks: {
		// 	'rollup:options'(ctx,options) {
		// 		console.log(options.treeshake)
		// 	}
		// }
	}
]);
