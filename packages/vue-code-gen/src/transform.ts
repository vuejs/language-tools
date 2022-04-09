import { isGloballyWhitelisted } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';

export function walkInterpolationFragment(
    ts: typeof import('typescript/lib/tsserverlibrary'),
    code: string,
    cb: (fragment: string, offset: number | undefined) => void,
    localVars: Record<string, number>,
) {

    let ctxVarOffsets: number[] = [];
    let localVarOffsets: number[] = [];

    const ast = ts.createSourceFile('/foo.ts', code, ts.ScriptTarget.ESNext);
    const varCb = (localVar: ts.Identifier) => {
        if (
            !!localVars[localVar.text] ||
            isGloballyWhitelisted(localVar.text) ||
            localVar.text === '$style'
        ) {
            localVarOffsets.push(localVar.getStart(ast));
        }
        else {
            ctxVarOffsets.push(localVar.getStart(ast));
        }
    };
    ast.forEachChild(node => walkIdentifiers(ts, node, varCb, localVars));

    ctxVarOffsets = ctxVarOffsets.sort((a, b) => a - b);
    localVarOffsets = localVarOffsets.sort((a, b) => a - b);

    if (ctxVarOffsets.length) {

        cb(code.substring(0, ctxVarOffsets[0]), 0);

        for (let i = 0; i < ctxVarOffsets.length - 1; i++) {
            cb('__VLS_ctx.', undefined);
            cb(code.substring(ctxVarOffsets[i], ctxVarOffsets[i + 1]), ctxVarOffsets[i]);
        }

        cb('__VLS_ctx.', undefined);
        cb(code.substring(ctxVarOffsets[ctxVarOffsets.length - 1]), ctxVarOffsets[ctxVarOffsets.length - 1]);
    }
    else {
        cb(code, 0);
    }
}

function walkIdentifiers(
    ts: typeof import('typescript/lib/tsserverlibrary'),
    node: ts.Node,
    cb: (varNode: ts.Identifier) => void,
    localVars: Record<string, number>,
) {

    const blockVars: string[] = [];

    if (ts.isIdentifier(node)) {
        cb(node);
    }
    else if (ts.isPropertyAccessExpression(node)) {
        walkIdentifiers(ts, node.expression, cb, localVars);
    }
    else if (ts.isVariableDeclaration(node)) {

        colletVars(ts, node.name, blockVars);

        for (const varName of blockVars)
            localVars[varName] = (localVars[varName] ?? 0) + 1;

        if (node.initializer)
            walkIdentifiers(ts, node.initializer, cb, localVars);
    }
    else if (ts.isArrowFunction(node)) {

        const functionArgs: string[] = [];

        for (const param of node.parameters)
            colletVars(ts, param.name, functionArgs);

        for (const varName of functionArgs)
            localVars[varName] = (localVars[varName] ?? 0) + 1;

        walkIdentifiers(ts, node.body, cb, localVars);

        for (const varName of functionArgs)
            localVars[varName]--;
    }
    else if (ts.isObjectLiteralExpression(node)) {
        for (const prop of node.properties) {
            if (ts.isPropertyAssignment(prop)) {
                walkIdentifiers(ts, prop.initializer, cb, localVars);
            }
        }
    }
    else if (ts.isTypeReferenceNode(node)) {
        // ignore
    }
    else {
        node.forEachChild(node => walkIdentifiers(ts, node, cb, localVars));
    }

    for (const varName of blockVars)
        localVars[varName]--;
}

export function colletVars(
    ts: typeof import('typescript/lib/tsserverlibrary'),
    node: ts.Node,
    result: string[],
) {
    if (ts.isIdentifier(node)) {
        result.push(node.text);
    }
    else if (ts.isObjectBindingPattern(node)) {
        for (const el of node.elements) {
            colletVars(ts, el.name, result);
        }
    }
    else if (ts.isArrayBindingPattern(node)) {
        for (const el of node.elements) {
            if (ts.isBindingElement(el)) {
                colletVars(ts, el.name, result);
            }
        }
    }
    else {
        node.forEachChild(node => colletVars(ts, node, result));
    }
}
