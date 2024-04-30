export * from './lib/protocol';
export * from './lib/types';

// export protocol and types of parent package
export * from '@volar/language-server/protocol';
export * from '@volar/language-server/lib/types';

// only export types of depend packages
export * from '@vue/language-service/lib/types';
