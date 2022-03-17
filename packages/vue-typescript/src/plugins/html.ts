import { VueLanguagePlugin } from "../typescriptRuntime";

export default function (): VueLanguagePlugin {

    return {

        compileTemplate(template, lang) {

            if (lang === 'html') {

                return {
                    result: template,
                    mapping: (htmlStart, htmlEnd) => ({ start: htmlStart, end: htmlEnd }),
                };
            }
        }
    }
}
