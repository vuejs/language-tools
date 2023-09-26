import { exactType } from 'vue-tsc/shared';
import Comp from './Comp.vue';

<Comp onFoo={s => exactType(s, '' as string)} />;
