import * as SourceMaps from '../utils/sourceMaps';
import type * as ts from 'typescript';

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
            right: undefined | {
                start: number,
                end: number,
                isComputedCall: boolean,
                withoutAs: {
                    start: number,
                    end: number,
                },
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
    const returnVarNames: {
        start: number,
        end: number,
        isImport: boolean,
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
    const dollars: number[] = [];

    const sourceFile = ts.createSourceFile('', content, ts.ScriptTarget.Latest);

    sourceFile.forEachChild(node => {
        if (ts.isVariableStatement(node)) {
            for (const node_2 of node.declarationList.declarations) {
                const vars = _findBindingVars(node_2.name);
                for (const _var of vars) {
                    returnVarNames.push({ ..._var, isImport: false });
                }
            }
        }
        else if (ts.isFunctionDeclaration(node)) {
            if (node.name && ts.isIdentifier(node.name)) {
                returnVarNames.push({ ..._getStartEnd(node.name), isImport: false });
            }
        }
        else if (ts.isImportDeclaration(node)) {
            if (node.importClause && !node.importClause.isTypeOnly) {
                if (node.importClause.name) {
                    returnVarNames.push({ ..._getStartEnd(node.importClause.name), isImport: true });
                }
                if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
                    for (const element of node.importClause.namedBindings.elements) {
                        returnVarNames.push({ ..._getStartEnd(element.name), isImport: true });
                    }
                }
            }
        }
    });
    sourceFile.forEachChild(node => {
        visitNode(node, sourceFile, true);
    });

    return {
        labels,
        returnVarNames,
        defineProps,
        defineEmit,
        dollars,
    };

    function _getStartEnd(node: ts.Node) {
        return getStartEnd(node, sourceFile);
    }
    function _findBindingVars(left: ts.BindingName) {
        return findBindingVars(ts, left, sourceFile);
    }
    function visitNode(node: ts.Node, parent: ts.Node, inRoot: boolean) {
        if (
            ts.isIdentifier(node)
            && node.getText(sourceFile).startsWith('$')
        ) {
            dollars.push(node.getStart(sourceFile));
        }
        if (
            ts.isLabeledStatement(node)
            && node.label.getText(sourceFile) === 'ref'
            && ts.isExpressionStatement(node.statement)
        ) {
            labels.push({
                ..._getStartEnd(node),
                label: _getStartEnd(node.label),
                parent: _getStartEnd(parent),
                binarys: findBinaryExpressions(node.statement.expression, inRoot),
            });
        }
        else if (
            ts.isCallExpression(node)
            && ts.isIdentifier(node.expression)
            && (
                node.expression.getText(sourceFile) === 'defineProps'
                || node.expression.getText(sourceFile) === 'defineEmit'
            )
        ) {
            // TODO: handle this
            // import * as vue from 'vue'
            // const props = vue.defineProps...
            const arg: ts.Expression | undefined = node.arguments.length ? node.arguments[0] : undefined;
            const typeArg: ts.TypeNode | undefined = node.typeArguments?.length ? node.typeArguments[0] : undefined;
            const call = {
                ..._getStartEnd(node),
                args: arg ? _getStartEnd(arg) : undefined,
                typeArgs: typeArg ? _getStartEnd(typeArg) : undefined,
            };
            if (node.expression.getText(sourceFile) === 'defineProps') {
                defineProps = call;
            }
            else if (node.expression.getText(sourceFile) === 'defineEmit') {
                defineEmit = call;
            }
        }
        node.forEachChild(child => visitNode(child, node, false));
    }
    function findBinaryExpressions(exp: ts.Expression, inRoot: boolean) {
        const binaryExps: typeof labels[0]['binarys'] = [];
        worker(exp);
        return binaryExps;
        function worker(node: ts.Expression, parenthesized?: ts.ParenthesizedExpression) {
            if (ts.isIdentifier(node)) {
                const range = _getStartEnd(node);
                binaryExps.push({
                    vars: findLabelVars(node, inRoot),
                    left: range,
                    parent: range,
                    right: undefined,
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
                    let rightWituoutAs = right;
                    let rightAs: ts.TypeNode | undefined;
                    if (ts.isAsExpression(node.right)) {
                        rightWituoutAs = node.right.expression;
                        rightAs = node.right.type;
                    }
                    const leftRange = _getStartEnd(node.left);
                    const rightRange = _getStartEnd(node.right);
                    const parentRange = _getStartEnd(parent);
                    if (parentRange.start <= leftRange.start && parentRange.end >= rightRange.end) { // fix `ref: in` #85
                        binaryExps.push({
                            vars: findLabelVars(node.left, inRoot),
                            left: leftRange,
                            right: {
                                ...rightRange,
                                isComputedCall: ts.isCallExpression(node.right) && ts.isIdentifier(node.right.expression) && node.right.expression.getText(sourceFile) === 'computed',
                                withoutAs: _getStartEnd(rightWituoutAs),
                                as: rightAs ? _getStartEnd(rightAs) : undefined,
                            },
                            parent: parentRange,
                        });
                    }
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
                    text: _node.getText(sourceFile), // TODO: remove
                    ..._getStartEnd(_node),
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
                    text: _node.name.getText(sourceFile), // TODO: remove
                    ..._getStartEnd(_node.name),
                });
            }
            // { ...? } = ...
            // [ ...? ] = ...
            else if (ts.isSpreadAssignment(_node) || ts.isSpreadElement(_node)) {
                worker(_node.expression);
            }
        }
    }
}

export function parse2(ts: typeof import('typescript'), content: string) {
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
    const shorthandPropertys: {
        start: number,
        end: number,
    }[] = [];

    const sourceFile = ts.createSourceFile('', content, ts.ScriptTarget.Latest);
    sourceFile.forEachChild(visitNode);

    return {
        refCalls,
        shorthandPropertys,
    };

    function _getStartEnd(node: ts.Node) {
        return getStartEnd(node, sourceFile);
    }
    function _findBindingVars(left: ts.BindingName) {
        return findBindingVars(ts, left, sourceFile);
    }
    function visitNode(node: ts.Node) {
        if (
            ts.isVariableDeclarationList(node)
            && node.declarations.length === 1
            && node.declarations[0].initializer
            && ts.isCallExpression(node.declarations[0].initializer)
            && ts.isIdentifier(node.declarations[0].initializer.expression)
            && ['ref', 'computed'].includes(node.declarations[0].initializer.expression.getText(sourceFile))
        ) {
            const declaration = node.declarations[0];
            const refCall = node.declarations[0].initializer;
            const isRef = refCall.expression.getText(sourceFile) === 'ref';
            const wrapContant = isRef ? (refCall.arguments.length ? refCall.arguments[0] : undefined) : refCall;
            const wrapType = isRef && refCall.typeArguments?.length ? refCall.typeArguments[0] : undefined;
            refCalls.push({
                ..._getStartEnd(node),
                vars: _findBindingVars(declaration.name),
                left: _getStartEnd(declaration.name),
                rightExpression: wrapContant ? _getStartEnd(wrapContant) : undefined,
                rightType: wrapType ? _getStartEnd(wrapType) : undefined,
            });
        }
        else if (ts.isShorthandPropertyAssignment(node)) {
            shorthandPropertys.push(_getStartEnd(node));
        }
        node.forEachChild(visitNode);
    }
}

function findBindingVars(ts: typeof import('typescript'), left: ts.BindingName, sourceFile: ts.SourceFile) {
    const vars: SourceMaps.Range[] = [];
    worker(left);
    return vars;
    function worker(_node: ts.Node) {
        if (ts.isIdentifier(_node)) {
            vars.push(getStartEnd(_node, sourceFile));
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
            vars.push(getStartEnd(_node.name, sourceFile));
        }
        // { ...? } = ...
        // [ ...? ] = ...
        else if (ts.isSpreadAssignment(_node) || ts.isSpreadElement(_node)) {
            worker(_node.expression);
        }
    }
}
export function getStartEnd(node: ts.Node, sourceFile: ts.SourceFile) {
    // TODO: high cost
    const start = node.getStart(sourceFile);
    const end = node.getEnd();
    return {
        start: start,
        end: end,
    };
}
