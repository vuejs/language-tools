export { commands } from '@vue/language-service';
export * from './lib/types';
export * from './lib/initialize';

// export protocol and types of parent package
export * from '@volar/language-server/lib/types';
export * from '@volar/language-server/protocol';

// only export types of depend packages
export * from '@vue/language-service/lib/types';
