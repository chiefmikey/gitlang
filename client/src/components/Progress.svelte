<script>
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  export let d;
  export let i;

  let data;

  let speed = 250 * (i + 1);

  const progress = tweened(0, {
    duration: 1000,
    easing: cubicOut,
  });

  setTimeout(() => progress.set(d.percent), speed);
</script>

<template>
  <tr style="animation: fadeIn .5s ease {i / 8}s forwards;">
    <div id="info">
      <td class="name">
        <span>{d.name}</span>
      </td>
      <td class="percent">
        <span>{`${Number((d.percent * 100).toFixed(2))}%`}</span>
      </td>
    </div>
    <td class="bar">
      <progress value={$progress} />
    </td>
  </tr>
</template>

<style>
  progress {
    width: 100%;
    height: 50px;
    fill: red;
  }

  #info {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    margin-bottom: -37px;
    z-index: 1;
    width: 100%;
  }

  .name span {
    font-size: 14px;
    padding: 0 5px 0 14px;
    font-weight: 600;
  }

  .bar {
    padding: 0;
    height: 44px;
  }

  .percent {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    height: 18px;
    padding-right: 10px;
  }

  .percent span {
    font-size: 12px;
    padding: 0;
  }
</style>
