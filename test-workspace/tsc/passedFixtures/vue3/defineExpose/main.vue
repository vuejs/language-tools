<script setup lang="ts">
import { exactType } from '../../shared';
import Child from './child.vue';

exactType(new Child().foo, {} as number);
</script>
