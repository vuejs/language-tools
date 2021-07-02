import * as SourceMaps from '../utils/sourceMaps';
import type * as ts from 'typescript';

export type Ast = ReturnType<typeof parse>;

export interface TextRange {
    start: number,
    end: number,
}

export function parse(ts: typeof import('typescript'), content: string, lang: string) {
    const labels: (TextRange & {
        binarys: {
            parent: TextRange,
            vars: (TextRange & {
                isShortand: boolean,
                inRoot: boolean,
            })[],
            left: TextRange,
            right: undefined | (TextRange & {
                isComputedCall: boolean,
                withoutAs: TextRange,
                as: undefined | TextRange,
            }),
        }[],
        label: TextRange,
        parent: TextRange,
    })[] = [];
    let withDefaultsArg: TextRange | undefined;
    let propsRuntimeArg: TextRange | undefined;
    let propsTypeArg: TextRange | undefined;
    let emitsRuntimeArg: TextRange | undefined;
    let emitsTypeArg: TextRange | undefined;
    const dollars: number[] = [];

    const sourceFile = ts.createSourceFile('foo.' + lang, content, ts.ScriptTarget.Latest);
    const bindings = collectBindings(ts, sourceFile);

    sourceFile.forEachChild(node => {
        visitNode(node, sourceFile, true);
    });

    return {
        labels,
        bindings,
        dollars,
        withDefaultsArg,
        propsRuntimeArg,
        propsTypeArg,
        emitsRuntimeArg,
        emitsTypeArg,
    };

    function _getStartEnd(node: ts.Node) {
        return getStartEnd(node, sourceFile);
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
        ) {
            const callText = node.expression.getText(sourceFile);
            if (
                callText === 'defineProps'
                || callText === 'defineEmit' // TODO: remove this in future
                || callText === 'defineEmits'
            ) {
                if (node.arguments.length) {
                    const runtimeArg = node.arguments[0];
                    if (callText === 'defineProps') {
                        propsRuntimeArg = _getStartEnd(runtimeArg);
                    }
                    else {
                        emitsRuntimeArg = _getStartEnd(runtimeArg);
                    }
                }
                else if (node.typeArguments?.length) {
                    const typeArg = node.typeArguments[0];
                    if (callText === 'defineProps') {
                        propsTypeArg = _getStartEnd(typeArg);
                    }
                    else {
                        emitsTypeArg = _getStartEnd(typeArg);
                    }
                }
            }
            else if (callText === 'withDefaults') {
                if (node.arguments.length >= 2) {
                    const arg = node.arguments[1];
                    withDefaultsArg = _getStartEnd(arg);
                }
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

export function collectBindings(ts: typeof import('typescript'), sourceFile: ts.SourceFile) {
    const bindings: TextRange[] = [];
    sourceFile.forEachChild(node => {
        if (ts.isVariableStatement(node)) {
            for (const node_2 of node.declarationList.declarations) {
                const vars = _findBindingVars(node_2.name);
                for (const _var of vars) {
                    bindings.push(_var);
                }
            }
        }
        else if (ts.isFunctionDeclaration(node)) {
            if (node.name && ts.isIdentifier(node.name)) {
                bindings.push(_getStartEnd(node.name));
            }
        }
        else if (ts.isImportDeclaration(node)) {
            if (node.importClause && !node.importClause.isTypeOnly) {
                if (node.importClause.name) {
                    bindings.push(_getStartEnd(node.importClause.name));
                }
                if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
                    for (const element of node.importClause.namedBindings.elements) {
                        bindings.push(_getStartEnd(element.name));
                    }
                }
            }
        }
        else if (ts.isClassDeclaration(node)) {
            if (node.name) {
                bindings.push(_getStartEnd(node.name));
            }
        }
        else if (ts.isEnumDeclaration(node)) {
            bindings.push(_getStartEnd(node.name));
        }
    });
    return bindings;
    function _getStartEnd(node: ts.Node) {
        return getStartEnd(node, sourceFile);
    }
    function _findBindingVars(left: ts.BindingName) {
        return findBindingVars(ts, left, sourceFile);
    }
}
export function parse2(ts: typeof import('typescript'), content: string, lang: string) {
    const refCalls: (TextRange & {
        vars: TextRange[],
        left: TextRange,
        rightExpression: undefined | TextRange,
        rightType: undefined | TextRange,
    })[] = [];
    const shorthandPropertys: TextRange[] = [];

    const sourceFile = ts.createSourceFile('foo.' + lang, content, ts.ScriptTarget.Latest);
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
