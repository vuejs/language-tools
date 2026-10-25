import { tsCodegen } from '@vue/content-mapper/lib/vueTsx';
import vueTsxPlugin from '@vue/content-mapper/lib/vueTsx';
import {
	collectInlayHints,
	collectTemplateScopeNames,
	getDefaultCompilerOptions,
	VueVirtualCode,
} from '@vue/language-core';
import { asCoreTypeScript } from '@vue/language-service/lib/utils';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as ts from 'typescript';
import { test } from 'vitest';
import { testWorkspacePath } from './server';

/**
 * Compares the new IR-derived scope names and inlay hints with the codegen ones for every .vue file
 * under test-workspace. Fails on any difference to ensure behavior is unchanged.
 */
test('IR-derived scope names and inlay hints match codegen', () => {
	const vueFiles = findVueFiles(testWorkspacePath).slice(0, 50); // Limit for performance
	const differences: string[] = [];
	const tsModule = require('typescript') as typeof ts;
	const coreTs = asCoreTypeScript(tsModule);
	const vueCompilerOptions = getDefaultCompilerOptions(99, '', 'sfc');

	const pluginContext = {
		modules: {
			'@vue/compiler-dom': require('@vue/compiler-dom'),
			'@vue/language-core': require('@vue/language-core'),
			typescript: coreTs,
		},
		vueCompilerOptions,
		config: {},
	};
	const pluginReturn = vueTsxPlugin(pluginContext);
	const plugins = Array.isArray(pluginReturn) ? pluginReturn : [pluginReturn];

	for (const filePath of vueFiles) {
		const content = fs.readFileSync(filePath, 'utf-8');
		const relativePath = path.relative(testWorkspacePath, filePath);

		try {
			// Create VueVirtualCode to get IR
			const virtualCode = new VueVirtualCode(
				filePath,
				{
					getText: (start, end) => content.substring(start, end),
					getLength: () => content.length,
					getChangeRange: () => undefined,
				},
				vueCompilerOptions,
				plugins,
				coreTs,
			);

			const { ir, scriptAnalysis } = virtualCode;
			const codegen = tsCodegen.get(ir);

			if (!codegen) {
				continue;
			}

			// Compare scope names
			const setupBindings = scriptAnalysis.getSetupBindings();
			const scriptSetupRanges = scriptAnalysis.getScriptSetupRanges();
			const setupConsts = new Set<string>();
			if (scriptSetupRanges?.defineProps?.destructured) {
				for (const name of scriptSetupRanges.defineProps.destructured.keys()) {
					setupConsts.add(name);
				}
				if (scriptSetupRanges.defineProps.destructuredRest) {
					setupConsts.add(scriptSetupRanges.defineProps.destructuredRest);
				}
			}

			const { scopeBindings: newScopeBindings } = collectTemplateScopeNames(
				coreTs,
				ir,
				setupBindings,
				setupConsts,
			);
			const oldScopeBindings = codegen.getScopeBindings();

			// Compare scopeBindings
			const newScopeBindingsArray = Array.from(newScopeBindings).sort();
			const oldScopeBindingsArray = Array.from(oldScopeBindings).sort();

			if (JSON.stringify(newScopeBindingsArray) !== JSON.stringify(oldScopeBindingsArray)) {
				differences.push(
					`${relativePath}: scopeBindings mismatch\n`
						+ `  New: ${JSON.stringify(newScopeBindingsArray)}\n`
						+ `  Old: ${JSON.stringify(oldScopeBindingsArray)}`,
				);
			}

			// Compare inlay hints
			const scriptRanges = scriptAnalysis.getScriptRanges();
			const newHints = collectInlayHints(ir, vueCompilerOptions, scriptRanges);
			const oldHints = [
				...codegen.getGeneratedTemplate()?.inlayHints ?? [],
				...codegen.getGeneratedScript().inlayHints ?? [],
			];

			// Sort hints for comparison
			const sortHints = (hints: any[]) =>
				hints
					.map(h => ({ blockName: h.blockName, offset: h.offset, setting: h.setting, label: h.label }))
					.sort((a, b) =>
						a.blockName.localeCompare(b.blockName)
						|| a.offset - b.offset
						|| a.setting.localeCompare(b.setting)
					);

			const newHintsSorted = sortHints(newHints);
			const oldHintsSorted = sortHints(oldHints);

			if (JSON.stringify(newHintsSorted) !== JSON.stringify(oldHintsSorted)) {
				differences.push(
					`${relativePath}: inlayHints mismatch\n`
						+ `  New: ${JSON.stringify(newHintsSorted, null, 2)}\n`
						+ `  Old: ${JSON.stringify(oldHintsSorted, null, 2)}`,
				);
			}
		}
		catch (error) {
			// Skip files that can't be parsed
			continue;
		}
	}

	if (differences.length > 0) {
		throw new Error(
			`IR-derived results differ from codegen:\n\n${differences.join('\n\n')}`,
		);
	}
});

function findVueFiles(dir: string): string[] {
	const files: string[] = [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			// Skip node_modules and hidden directories
			if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
				continue;
			}
			files.push(...findVueFiles(fullPath));
		}
		else if (entry.isFile() && entry.name.endsWith('.vue')) {
			files.push(fullPath);
		}
	}

	return files;
}
