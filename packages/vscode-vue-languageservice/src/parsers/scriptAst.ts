import type * as ts from 'typescript';
import { getStartEnd } from './scriptSetupAst';

export type Ast = ReturnType<typeof parse>;

export function parse(ts: typeof import('typescript'), content: string, withComponentOption = false, withNode = false) {

    let exportDefault: {
        start: number,
        end: number,
        args: {
            start: number,
            end: number,
        },
        argsNode: ts.ObjectLiteralExpression | undefined,
        componentsOption: {
            start: number,
            end: number,
        } | undefined,
        componentsOptionNode: ts.ObjectLiteralExpression | undefined,
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
                let componentsOptionNode: ts.ObjectLiteralExpression | undefined;
                if (withComponentOption) {
                    obj.forEachChild(node => {
                        if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
                            if (node.name.escapedText === 'components' && ts.isObjectLiteralExpression(node.initializer)) {
                                componentsOptionNode = node.initializer;
                            }
                        }
                    });
                }
                exportDefault = {
                    ..._getStartEnd(node),
                    args: _getStartEnd(obj),
                    argsNode: withNode ? obj : undefined,
                    componentsOption: componentsOptionNode ? _getStartEnd(componentsOptionNode) : undefined,
                    componentsOptionNode: withNode ? componentsOptionNode : undefined,
                };
            }
        }
    });

    return {
        sourceFile,
        exportDefault,
    };

    function _getStartEnd(node: ts.Node) {
        return getStartEnd(node, sourceFile);
    }
}