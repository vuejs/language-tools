import { getDefaultCompilerOptions } from '@vue/language-core';
import type { OptionDiagnostic } from './protocol';

/**
 * Stable codes for the diagnostics reported through `optionDiagnostics`. The host renders them against
 * the mapper entry in the tsconfig, using the mapper's diagnostic source, e.g.
 * `error @vue/content-mapper@3.3.9(2): Option 'strictTemplates' was removed in v4. ...`
 */
export enum OptionDiagnosticCode {
	UnknownOption = 1,
	RemovedOption = 2,
	InvalidOptionType = 3,
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
};

/**
 * Validates the mapper entry's `options` object and returns diagnostics for options the mapper does not
 * understand. Paths are relative to that object, matching the host's `optionDiagnostics` contract.
 * `languageFeatures` is consumed by the mapper itself and is skipped.
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
		if (key === 'vueCompilerOptions') {
			diagnostics.push({
				path,
				messageText:
					`Options are flattened in v4: pass them directly under the mapper's \`options\` instead of nesting them in \`vueCompilerOptions\`.`,
				code: OptionDiagnosticCode.UnknownOption,
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
		if (!(key in defaults)) {
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
