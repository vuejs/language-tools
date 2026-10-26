import { getDefaultCompilerOptions } from '@vue/language-core';
import type { OptionDiagnostic } from '../protocol';

/**
 * Stable codes for the diagnostics reported through `optionDiagnostics`. The host renders them against
 * the mapper entry in the tsconfig, using the mapper's diagnostic source, e.g.
 * `error @vue/content-mapper@3.3.9(2): Option 'strictTemplates' was removed in v4. ...`
 */
export enum OptionDiagnosticCode {
	UnknownOption = 1,
	RemovedOption = 2,
	InvalidOptionType = 3,
	/** A `plugins` entry, or a part of it, that fails to load. */
	InvalidPlugin = 4,
}

/** Options removed in v4, reported with a migration hint instead of a plain unknown-option message. */
const removedOptions: Record<string, string> = {
	strictTemplates:
		`Template checking now follows the TypeScript settings for the script's language, so this option has no equivalent.`,
	strictVModel: `\`v-model\` is always checked strictly, so this option has no equivalent.`,
	checkUnknownComponents:
		`Unknown components are always reported; declare them in the \`GlobalComponents\` interface instead.`,
	checkUnknownDirectives:
		`Unknown directives are always reported; declare them in the \`GlobalDirectives\` interface instead.`,
	checkUnknownEvents: `Unknown events are always reported, so this option has no equivalent.`,
	checkUnknownProps: `Unknown props are always reported, so this option has no equivalent.`,
	extensions: `Set \`extensions\` on the \`contentMappers\` entry instead.`,
	skipTemplateCodegen: `The template is always generated and type-checked, so this option has no equivalent.`,
	resolveStyleImports:
		`Vue no longer reads CSS imports; \`<style module src>\` is always typed by importing its \`src\`, and CSS files are typed by CSS content mappers or declarations.`,
};

const formatMessage = `Option 'format' requires 'sfc', 'vitepress', 'petite-vue' or a format of a plugin.`;

/** Resolved fields computed from other options (e.g. precompiled glob matchers or the template context set by `format: "petite-vue"`); not user-settable. */
const derivedOptions = new Set(['isDataAttribute', 'isHtmlAttribute', 'globalTemplateContext']);

/**
 * Validates the mapper entry's `options` object and returns diagnostics for options the mapper does not
 * understand. Paths are relative to that object, matching the host's `optionDiagnostics` contract.
 * `languageFeatures` and `format` are consumed by the mapper itself, not by the Vue compiler options.
 */
export function toOptionDiagnostics(options: Record<string, unknown> | undefined): OptionDiagnostic[] {
	if (!options) {
		return [];
	}
	const defaults = getDefaultCompilerOptions() as unknown as Record<string, unknown>;
	const diagnostics: OptionDiagnostic[] = [];
	for (const key of Object.keys(options)) {
		if (key === 'languageFeatures') {
			continue;
		}
		const value = options[key];
		const path = [key];
		if (key === 'format') {
			if (typeof value !== 'string') {
				diagnostics.push(invalid(path, formatMessage));
			}
			continue;
		}
		if (key === 'vueCompilerOptions') {
			diagnostics.push({
				path,
				messageText:
					`Options are flattened in v4: pass them directly under the mapper's \`options\` instead of nesting them in \`vueCompilerOptions\`.`,
				code: OptionDiagnosticCode.UnknownOption,
			});
			continue;
		}
		if (key === 'experimentalModelPropName') {
			diagnostics.push({
				path,
				messageText: `Option '${key}' was removed in v4. Use \`vModelPropName\`, which maps each tag to the prop `
					+ `its \`v-model\` binds or \`false\` for none: ${describeLegacyVModelPropName(value)}`,
				code: OptionDiagnosticCode.RemovedOption,
			});
			continue;
		}
		if (key in removedOptions) {
			diagnostics.push({
				path,
				messageText: `Option '${key}' was removed in v4. ${removedOptions[key]}`,
				code: OptionDiagnosticCode.RemovedOption,
			});
			continue;
		}
		if (!(key in defaults) || derivedOptions.has(key)) {
			diagnostics.push({
				path,
				messageText: `Unknown option '${key}'.`,
				code: OptionDiagnosticCode.UnknownOption,
			});
			continue;
		}
		diagnostics.push(...validateValue(path, value, defaults[key], key));
	}
	return diagnostics;
}

function validateValue(
	path: (string | number)[],
	value: unknown,
	defaultValue: unknown,
	key: string,
): OptionDiagnostic[] {
	if (key === 'target') {
		if (value !== 'auto' && typeof value !== 'number') {
			return [invalid(path, `Option 'target' requires a number or 'auto'.`)];
		}
		return [];
	}
	if (key === 'resolveStyleClassNames') {
		if (typeof value !== 'boolean' && value !== 'scoped') {
			return [invalid(path, `Option 'resolveStyleClassNames' requires a boolean or 'scoped'.`)];
		}
		return [];
	}
	if (key === 'plugins') {
		return validatePlugins(path, value);
	}
	if (key === 'vModelPropName') {
		return validateVModelPropName(path, value);
	}
	if (Array.isArray(defaultValue)) {
		if (!Array.isArray(value)) {
			return [invalid(path, `Option '${key}' requires an array.`)];
		}
		if (key === 'optionsWrapper' && value.some(item => typeof item !== 'string')) {
			return [invalid(path, `Option 'optionsWrapper' requires an array of strings.`)];
		}
		return [];
	}
	if (typeof defaultValue === 'boolean') {
		return typeof value === 'boolean' ? [] : [invalid(path, `Option '${key}' requires a boolean.`)];
	}
	if (typeof defaultValue === 'string') {
		return typeof value === 'string' ? [] : [invalid(path, `Option '${key}' requires a string.`)];
	}
	if (typeof defaultValue === 'number') {
		return typeof value === 'number' ? [] : [invalid(path, `Option '${key}' requires a number.`)];
	}
	if (isPlainObject(defaultValue)) {
		return isPlainObject(value) ? [] : [invalid(path, `Option '${key}' requires an object.`)];
	}
	return [];
}

function validatePlugins(path: (string | number)[], value: unknown): OptionDiagnostic[] {
	if (!Array.isArray(value)) {
		return [invalid(path, `Option 'plugins' requires an array.`)];
	}
	const diagnostics: OptionDiagnostic[] = [];
	for (let index = 0; index < value.length; index++) {
		const plugin = value[index];
		if (typeof plugin === 'string') {
			continue;
		}
		if (!isPlainObject(plugin)) {
			diagnostics.push(invalid([...path, index], `Option 'plugins' entries require a string or an object.`));
			continue;
		}
		// Plugin config objects carry arbitrary fields for the plugin itself, so only `name` is checked.
		if (typeof plugin.name !== 'string') {
			diagnostics.push(invalid([...path, index, 'name'], `Option 'name' requires a string.`));
		}
	}
	return diagnostics;
}

function validateVModelPropName(path: (string | number)[], value: unknown): OptionDiagnostic[] {
	if (!isPlainObject(value)) {
		return [invalid(path, `Option 'vModelPropName' requires an object.`)];
	}
	const entries = Object.entries(value);
	// the prop-keyed shape of `experimentalModelPropName` maps tags to `true` or to attribute conditions
	if (entries.some(([, tags]) => isPlainObject(tags))) {
		return [invalid(
			path,
			`Option 'vModelPropName' maps each tag to the prop its \`v-model\` binds or \`false\` for none: `
				+ describeLegacyVModelPropName(value),
		)];
	}
	return entries
		.filter(([, prop]) => prop !== false && typeof prop !== 'string')
		.map(([tag]) => invalid([...path, tag], `Option 'vModelPropName' entries require a prop name or \`false\`.`));
}

/** Converts the prop-keyed shape of `experimentalModelPropName` and describes what it could not convert. */
function describeLegacyVModelPropName(value: unknown) {
	const converted: Record<string, string | false> = {};
	const conditionedTags: string[] = [];
	if (isPlainObject(value)) {
		for (const [prop, tags] of Object.entries(value)) {
			if (!isPlainObject(tags)) {
				continue;
			}
			for (const [tag, match] of Object.entries(tags)) {
				if (match !== true) {
					// the built-in rules of `<input>` follow its `type` like the old attribute conditions did
					if (tag !== 'input') {
						conditionedTags.push(tag);
					}
				}
				else if (!(tag in legacyNativeDefaults) || legacyNativeDefaults[tag] !== prop) {
					converted[tag] = prop || false;
				}
			}
		}
	}
	let text = `${JSON.stringify(converted)}.`;
	if (conditionedTags.length) {
		text += ` Attribute conditions are not supported, so these tags need an entry of their own: ${
			conditionedTags.map(tag => `'${tag}'`).join(', ')
		}.`;
	}
	return text
		+ ` TypeScript 7 drops \`""\` keys from these options, so entries under \`""\` are missing; add them as \`false\`.`;
}

/** Entries of the old default, which the built-in rules of native elements cover. */
const legacyNativeDefaults: Record<string, string> = {
	input: '',
	textarea: 'value',
	select: 'value',
};

function invalid(path: (string | number)[], messageText: string): OptionDiagnostic {
	return {
		path,
		messageText,
		code: OptionDiagnosticCode.InvalidOptionType,
	};
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
