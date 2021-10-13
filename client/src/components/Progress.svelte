<script>
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  const progress = tweened(0, {
    duration: 1000,
    easing: cubicOut,
  });

  export let d;
  setTimeout(() => progress.set(d.percent), 0);
</script>

<template>
  <tr>
    <td class="name">
      <span>{d.name}</span>
    </td>
    <td class="bar">
      <progress value={$progress} />
    </td>
    <td class="percent">
      <span>{`${Number((d.percent * 100).toFixed(2))}%`}</span>
    </td>
  </tr>
</template>

<style>
  .name {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    text-align: right;
    font-size: 16px;
    width: 80px;
  }

  .percent {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    text-align: left;
    font-size: 12px;
  }
</style>
