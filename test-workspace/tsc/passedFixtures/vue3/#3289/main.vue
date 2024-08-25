<script lang="tsx">
import { exactType } from '../../shared';
import Child from './child.vue';

<Child onFoo={s => exactType(s, '' as string)} />;
</script>
