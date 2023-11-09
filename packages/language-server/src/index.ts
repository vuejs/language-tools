export * from './protocol';
export * from './types';

// export protocol and types of parent package
export * from '@volar/language-server/protocol';
export * from '@volar/language-server/lib/types';

// only export types of depend packages
export * from '@vue/language-service/out/types';
