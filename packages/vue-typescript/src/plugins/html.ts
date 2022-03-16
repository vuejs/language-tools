import { VuePlugin } from "../typescriptRuntime";

export default function (): VuePlugin {

    return {

        compileTemplate(template, lang) {

            if (lang === 'html') {

                return {
                    html: template,
                    htmlToTemplate: (htmlStart, htmlEnd) => ({ start: htmlStart, end: htmlEnd }),
                };
            }
        }
    }
}
