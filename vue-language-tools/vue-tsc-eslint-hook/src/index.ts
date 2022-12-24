import { ESLint, Linter } from 'eslint';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { createProgram } from 'vue-tsc';

export = async function (
	program: ReturnType<typeof createProgram>,
	resolveConfig: (tsProgram: ts.Program) => Linter.Config,
) {

	const tsProgram = program.__vue.languageService.__internal__.languageService.getProgram()!;
	const eslint = new ESLint({
		baseConfig: resolveConfig(tsProgram),
		useEslintrc: false,
	});
	const fileNames = program.__vue.languageServiceHost.getScriptFileNames();
	const mapper = program.__vue.languageService.__internal__.context.mapper;
	const formatter = await eslint.loadFormatter();

	for (const fileName of fileNames) {

		const vueFile = mapper.get(fileName)?.[1];

		if (vueFile) {

			const sourceDocument = TextDocument.create('', '', 0, vueFile.snapshot.getText(0, vueFile.snapshot.getLength()));
			const all: typeof vueFile.embeddeds = [];

			vueFile.embeddeds.forEach(async function visit(embeddedFile) {
				if (embeddedFile.capabilities.diagnostic) {
					all.push(embeddedFile);
				}
				embeddedFile.embeddeds.forEach(visit);
			});

			for (const embeddedFile of all) {

				const lintResult = await eslint.lintText(
					embeddedFile.snapshot.getText(0, embeddedFile.snapshot.getLength()),
					{ filePath: embeddedFile.fileName },
				);
				const embeddedDocument = TextDocument.create('', '', 0, embeddedFile.snapshot.getText(0, embeddedFile.snapshot.getLength()));

				for (const result of lintResult) {

					result.filePath = vueFile.fileName;
					result.errorCount = 0;
					result.warningCount = 0;
					result.fixableErrorCount = 0;
					result.fixableWarningCount = 0;
					const messages: Linter.LintMessage[] = [];

					for (const message of result.messages) {

						if (!message.line || !message.column) {
							message.line = 1;
							message.column = 1;
						}

						const msgStart = embeddedDocument.offsetAt({
							line: message.line - 1,
							character: message.column - 1,
						});
						const msgEnd = embeddedDocument.offsetAt({
							line: (message.endLine ?? message.line) - 1,
							character: (message.endColumn ?? message.column) - 1,
						});
						const map = mapper.getSourceMap(embeddedFile);

						for (const start of map.toSourceOffsets(msgStart)) {

							if (!start[1].data.diagnostic)
								continue;

							for (const end of map.toSourceOffsets(msgEnd, true)) {

								if (!end[1].data.diagnostic)
									continue;

								const range = {
									start: sourceDocument.positionAt(start[0]),
									end: sourceDocument.positionAt(end[0]),
								};
								messages.push({
									...message,
									line: range.start.line + 1,
									column: range.start.character + 1,
									endLine: range.end.line + 1,
									endColumn: range.end.character + 1,
								});
								result.errorCount += message.severity === 2 ? 1 : 0;
								result.warningCount += message.severity === 1 ? 1 : 0;
								result.fixableErrorCount += message.severity === 2 && message.fix ? 1 : 0;
								result.fixableWarningCount += message.severity === 1 && message.fix ? 1 : 0;

								break;
							}

							break;
						}
					}

					result.messages = messages;
				}

				const text = await formatter.format(lintResult);
				if (text) {
					console.log(text);
				}
				break;
			}
		}
		else {

			const fileText = tsProgram?.getSourceFile(fileName)?.text ?? '';
			const lintResult = await eslint.lintText(
				fileText,
				{ filePath: fileName },
			);

			const text = await formatter.format(lintResult);
			if (text) {
				console.log(text);
			}
		}
	}
};
