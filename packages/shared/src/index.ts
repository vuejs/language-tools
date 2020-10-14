export * from './path';
export * from './requests';

export function sleep(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
