interface Options {
	Project: 'project',
};
interface CustomOptions extends Record<Options[keyof Options], string> {};

const ARGS_ACCESS_NUM = 2;
const OPTIONS = {
	Project: 'project',
} as const satisfies Options;
const OPTIONS_PREFIX = '--';

export function createCliOptions(): CustomOptions | undefined {
	const args = structuredClone(process.argv);
	let parsedOptions: CustomOptions | undefined
	args.slice(ARGS_ACCESS_NUM).forEach((arg, i) => {
		const options = Object.values(OPTIONS)
		const optionStrings = options.map(t => `${OPTIONS_PREFIX}${t}`);
		if (!optionStrings.includes(arg)) {
			return;
		}
		if (args[i + 1] == null) {
			return;
		}
		const findIndex = optionStrings.findIndex(s => s === arg);
		if (findIndex !== -1 && !!options[findIndex]) {
			parsedOptions = {
				...(parsedOptions ?? {}),
				[options[findIndex]]: args.slice(ARGS_ACCESS_NUM)[findIndex + 1],
			};
			// required to remove custom options and value for executing runTsc()
			process.argv = process.argv.filter((_, j) => j !== i + ARGS_ACCESS_NUM && j !== i + ARGS_ACCESS_NUM + 1);
		}
	});
	return parsedOptions;
};
