import type * as ts from 'typescript';
import { getStartEnd } from './scriptSetupAst';

export type Ast = ReturnType<typeof parse>;

export function parse(ts: typeof import('typescript'), content: string) {

    let exportDefault: {
        start: number,
        end: number,
        expression: {
            start: number,
            end: number,
        },
        args: {
            start: number,
            end: number,
        },
    } | undefined;

    const sourceFile = ts.createSourceFile('', content, ts.ScriptTarget.Latest);
    sourceFile.forEachChild(node => {
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
                    ..._getStartEnd(node),
                    expression: _getStartEnd(node.expression),
                    args: _getStartEnd(obj),
                };
            }
        }
    });

    return {
        exportDefault,
    };

    function _getStartEnd(node: ts.Node) {
        return getStartEnd(node, sourceFile);
    }
}