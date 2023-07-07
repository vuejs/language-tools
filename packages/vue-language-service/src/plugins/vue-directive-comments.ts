import { CompletionItem, Service } from '@volar/language-service';

const cmds = [
	'vue-ignore',
	'vue-skip',
	'vue-expect-error',
];

const directiveCommentReg = /<!--\s+@/;

const plugin: Service = (): ReturnType<Service> => {

	return {

		triggerCharacters: ['@'],

		provideCompletionItems(document, position) {

			if (document.languageId !== 'html')
				return;

			const line = document.getText({ start: { line: position.line, character: 0 }, end: position });
			const cmdStart = line.match(directiveCommentReg);
			if (!cmdStart)
				return;

			const startIndex = cmdStart.index! + cmdStart[0].length;
			const remainText = line.substring(startIndex);
			const result: CompletionItem[] = [];

			for (const cmd of cmds) {
				let match = true;
				for (let i = 0; i < remainText.length; i++) {
					if (remainText[i] !== cmd[i]) {
						console.log(JSON.stringify(remainText[i]), JSON.stringify(cmd[i]));
						match = false;
						break;
					}
				}
				if (match) {
					result.push({
						label: '@' + cmd,
						textEdit: {
							range: {
								start: {
									line: position.line,
									character: startIndex - 1,
								},
								end: position,
							},
							newText: '@' + cmd,
						},
					});
				}
			}

			return {
				isIncomplete: false,
				items: result,
			};
		},
	};
};

export default () => plugin;
