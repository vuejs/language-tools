export * from './protocol';
export * from './types';

// export protocol and types of parent package
export * from '@volar/language-server/out/protocol';
export * from '@volar/language-server/out/types';

// only export types of depend packages
export * from '@volar/vue-language-service/out/types';
