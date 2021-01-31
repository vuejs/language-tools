import { MapedRange } from '../utils/sourceMaps';
import type * as ts from 'typescript';
import { replaceToComment } from '../utils/string';

export type Ast = ReturnType<typeof parse>;

export function parse(ts: typeof import('typescript'), content: string) {
    const labels: {
        start: number,
        end: number,
        binarys: {
            parent: {
                start: number,
                end: number,
            },
            vars: {
                isShortand: boolean,
                inRoot: boolean,
                text: string,
                start: number,
                end: number,
            }[],
            left: {
                start: number,
                end: number,
            },
            right?: {
                start: number,
                end: number,
                isComputedCall: boolean,
                as: undefined | {
                    start: number,
                    end: number,
                },
            },
        }[],
        label: {
            start: number,
            end: number,
        },
        parent: {
            start: number,
            end: number,
        },
    }[] = [];
    const exposeVarNames: {
        start: number,
        end: number,
    }[] = [];
    const imports: {
        start: number,
        end: number,
    }[] = [];
    let defineProps: {
        start: number,
        end: number,
        args?: {
            start: number,
            end: number,
        },
        typeArgs?: {
            start: number,
            end: number,
        },
    } | undefined;
    let defineEmit: typeof defineProps;
    const refCalls: {
        start: number,
        end: number,
        vars: {
            start: number,
            end: number,
        }[],
        left: {
            start: number,
            end: number,
        },
        rightExpression: undefined | {
            start: number,
            end: number,
        },
        rightType: undefined | {
            start: number,
            end: number,
        },
    }[] = [];
    const shorthandPropertys: { // TODO: remove
        start: number,
        end: number,
    }[] = [];
    const dollars: number[] = [];

    const scriptAst = ts.createSourceFile('', content, ts.ScriptTarget.Latest);

    scriptAst.forEachChild(node => {
        if (ts.isVariableStatement(node)) {
            for (const node_2 of node.declarationList.declarations) {
                const vars = findBindingVars(node_2.name);
                for (const _var of vars) {
                    exposeVarNames.push(_var);
                }
            }
        }
        else if (ts.isFunctionDeclaration(node)) {
            if (node.name && ts.isIdentifier(node.name)) {
                exposeVarNames.push(getStartEnd(node.name));
            }
        }
        else if (ts.isImportDeclaration(node)) {
            imports.push(getStartEnd(node));
            if (node.importClause && !node.importClause.isTypeOnly) {
                if (node.importClause.name) {
                    exposeVarNames.push(getStartEnd(node.importClause.name));
                }
                if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
                    for (const element of node.importClause.namedBindings.elements) {
                        exposeVarNames.push(getStartEnd(element.name));
                    }
                }
            }
        }
    });
    scriptAst.forEachChild(node => {
        deepLoop(node, scriptAst, true);
    });

    let noLabelCode = content;
    for (const label of labels) {
        noLabelCode = noLabelCode.substring(0, label.label.start) + 'let' + noLabelCode.substring(label.label.end).replace(':', ' ');
        for (const binary of label.binarys) {
            if (binary.parent.start !== binary.left.start) {
                noLabelCode = replaceToComment(noLabelCode, binary.parent.start, binary.left.start);
            }
            if (binary.parent.end !== binary.left.end) {
                noLabelCode = replaceToComment(noLabelCode, (binary.right ?? binary.left).end, binary.parent.end);
            }
        }
    }

    return {
        labels,
        exposeVarNames,
        imports,
        defineProps,
        defineEmit,
        refCalls,
        shorthandPropertys,
        dollars,
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
    function deepLoop(node: ts.Node, parent: ts.Node, inRoot: boolean) {
        if (
            ts.isIdentifier(node)
            && node.getText(scriptAst).startsWith('$')
        ) {
            dollars.push(node.getStart(scriptAst));
        }
        if (
            ts.isLabeledStatement(node)
            && node.label.getText(scriptAst) === 'ref'
            && ts.isExpressionStatement(node.statement)
        ) {
            labels.push({
                ...getStartEnd(node),
                label: getStartEnd(node.label),
                parent: getStartEnd(parent),
                binarys: findBinaryExpressions(node.statement.expression, inRoot),
            });
        }
        else if (
            ts.isCallExpression(node)
            && ts.isIdentifier(node.expression)
            && (
                node.expression.getText(scriptAst) === 'defineProps'
                || node.expression.getText(scriptAst) === 'defineEmit'
            )
        ) {
            // TODO: handle this
            // import * as vue from 'vue'
            // const props = vue.defineProps...
            const arg: ts.Expression | undefined = node.arguments.length ? node.arguments[0] : undefined;
            const typeArg: ts.TypeNode | undefined = node.typeArguments?.length ? node.typeArguments[0] : undefined;
            const call = {
                ...getStartEnd(node),
                args: arg ? getStartEnd(arg) : undefined,
                typeArgs: typeArg ? getStartEnd(typeArg) : undefined,
            };
            if (node.expression.getText(scriptAst) === 'defineProps') {
                defineProps = call;
            }
            else if (node.expression.getText(scriptAst) === 'defineEmit') {
                defineEmit = call;
            }
        }
        else if (
            ts.isVariableDeclarationList(node)
            && node.declarations.length === 1
            && node.declarations[0].initializer
            && ts.isCallExpression(node.declarations[0].initializer)
            && ts.isIdentifier(node.declarations[0].initializer.expression)
            && ['ref', 'computed'].includes(node.declarations[0].initializer.expression.getText(scriptAst))
        ) {
            const declaration = node.declarations[0];
            const refCall = node.declarations[0].initializer;
            const isRef = refCall.expression.getText(scriptAst) === 'ref';
            const wrapContant = isRef ? (refCall.arguments.length ? refCall.arguments[0] : undefined) : refCall;
            const wrapType = isRef && refCall.typeArguments?.length ? refCall.typeArguments[0] : undefined;
            refCalls.push({
                ...getStartEnd(node),
                vars: findBindingVars(declaration.name),
                left: getStartEnd(declaration.name),
                rightExpression: wrapContant ? getStartEnd(wrapContant) : undefined,
                rightType: wrapType ? getStartEnd(wrapType) : undefined,
            });
        }
        else if (ts.isShorthandPropertyAssignment(node)) {
            shorthandPropertys.push(getStartEnd(node));
        }
        node.forEachChild(child => deepLoop(child, node, false));
    }
    function findBinaryExpressions(exp: ts.Expression, inRoot: boolean) {
        const binaryExps: typeof labels[0]['binarys'] = [];
        worker(exp);
        return binaryExps;
        function worker(node: ts.Expression, parenthesized?: ts.ParenthesizedExpression) {
            if (ts.isIdentifier(node)) {
                const range = getStartEnd(node);
                binaryExps.push({
                    vars: findLabelVars(node, inRoot),
                    left: range,
                    parent: range,
                });
            }
            if (ts.isBinaryExpression(node)) {
                if (ts.isBinaryExpression(node.left) || ts.isBinaryExpression(node.right) || ts.isParenthesizedExpression(node.left) || ts.isParenthesizedExpression(node.right)) {
                    worker(node.left);
                    worker(node.right);
                }
                else {
                    let parent: ts.Node = parenthesized ?? node;
                    let right = node.right;
                    let rightAs: ts.TypeNode | undefined;
                    if (ts.isAsExpression(node.right)) {
                        right = node.right.expression;
                        rightAs = node.right.type;
                    }
                    binaryExps.push({
                        vars: findLabelVars(node.left, inRoot),
                        left: getStartEnd(node.left),
                        right: {
                            ...getStartEnd(right),
                            isComputedCall: ts.isCallExpression(node.right) && ts.isIdentifier(node.right.expression) && node.right.expression.getText(scriptAst) === 'computed',
                            as: rightAs ? getStartEnd(rightAs) : undefined,
                        },
                        parent: getStartEnd(parent),
                    });
                }
            }
            else if (ts.isParenthesizedExpression(node)) {
                // unwrap (...)
                worker(node.expression, parenthesized ?? node);
            }
        }
    }
    function findLabelVars(exp: ts.Expression, inRoot: boolean) {
        const vars: typeof labels[0]['binarys'][0]['vars'] = [];
        worker(exp);
        return vars;
        function worker(_node: ts.Node) {
            if (ts.isIdentifier(_node)) {
                vars.push({
                    isShortand: false,
                    inRoot,
                    text: _node.getText(scriptAst), // TODO: remove
                    ...getStartEnd(_node),
                });
            }
            // { ? } = ...
            else if (ts.isObjectLiteralExpression(_node)) {
                for (const property of _node.properties) {
                    worker(property);
                }
            }
            // [ ? ] = ...
            else if (ts.isArrayLiteralExpression(_node)) {
                for (const property of _node.elements) {
                    worker(property);
                }
            }
            // { foo: ? } = ...
            else if (ts.isPropertyAssignment(_node)) {
                worker(_node.initializer);
            }
            // { e: f = 2 } = ...
            else if (ts.isBinaryExpression(_node) && ts.isIdentifier(_node.left)) {
                worker(_node.left);
            }
            // { foo } = ...
            else if (ts.isShorthandPropertyAssignment(_node)) {
                vars.push({
                    isShortand: true,
                    inRoot,
                    text: _node.name.getText(scriptAst), // TODO: remove
                    ...getStartEnd(_node.name),
                });
            }
            // { ...? } = ...
            // [ ...? ] = ...
            else if (ts.isSpreadAssignment(_node) || ts.isSpreadElement(_node)) {
                worker(_node.expression);
            }
        }
    }
    function findBindingVars(left: ts.BindingName) {
        const vars: MapedRange[] = [];
        worker(left);
        return vars;
        function worker(_node: ts.Node) {
            if (ts.isIdentifier(_node)) {
                vars.push(getStartEnd(_node));
            }
            // { ? } = ...
            // [ ? ] = ...
            else if (ts.isObjectBindingPattern(_node) || ts.isArrayBindingPattern(_node)) {
                for (const property of _node.elements) {
                    if (ts.isBindingElement(property)) {
                        worker(property.name);
                    }
                }
            }
            // { foo: ? } = ...
            else if (ts.isPropertyAssignment(_node)) {
                worker(_node.initializer);
            }
            // { foo } = ...
            else if (ts.isShorthandPropertyAssignment(_node)) {
                vars.push(getStartEnd(_node.name));
            }
            // { ...? } = ...
            // [ ...? ] = ...
            else if (ts.isSpreadAssignment(_node) || ts.isSpreadElement(_node)) {
                worker(_node.expression);
            }
        }
    }
}
