import type * as ts from 'typescript';

export type Ast = ReturnType<typeof parse>;

export function parse(ts: typeof import('typescript'), content: string) {

    let exportDefault: {
        start: number,
        end: number,
        args: {
            text: string,
            start: number,
            end: number,
        },
    } | undefined;

    const scriptAst = ts.createSourceFile('', content, ts.ScriptTarget.Latest);
    scriptAst.forEachChild(node => {
        if (ts.isExportAssignment(node)) {
            let obj: ts.ObjectLiteralExpression | undefined;
            if (ts.isObjectLiteralExpression(node.expression)) {
                obj = node.expression;
            }
            else if (ts.isCallExpression(node.expression) && node.expression.arguments.length) {
                const arg0 = node.expression.arguments[0];
                if (ts.isObjectLiteralExpression(arg0)) {
                    obj = arg0;
                }
            }
            if (obj) {
                exportDefault = {
                    ...getStartEnd(node),
                    args: {
                        text: obj.getText(scriptAst),
                        ...getStartEnd(obj),
                    },
                };
            }
        }
    });

    return {
        exportDefault,
    };

    function getStartEnd(node: ts.Node) {
        // TODO: high cost
        const start = node.getStart(scriptAst);
        const end = node.getEnd();
        return {
            start: start,
            end: end,
        };
    }
}