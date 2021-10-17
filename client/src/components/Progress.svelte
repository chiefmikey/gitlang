<script>
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  export let d;
  export let i;

  let currentPercent = 0;
  let finalPercent = Number((d.percent * 100).toFixed(2));
  let data;
  let speed = 80 * (i + 1) + 250;

  const progress = tweened(0, {
    duration: 1000,
    easing: cubicOut,
  });

  const progress2 = tweened(0, {
    duration: 1000,
    easing: cubicOut,
  });

  setTimeout(() => ($progress = d.percent), speed);
  setTimeout(() => ($progress2 = finalPercent), speed);
  setTimeout(() => {
    const prog = document.getElementById(`bar${i}`);
    const info = document.getElementsByClassName(`info${i}`);
    prog.style.setProperty(
      '--c',
      `rgb(${255 - i * 10}, ${192 - i * 10}, ${203 - i * 4})`,
    );
    info[0].style.color = `rgb(${0 + i * 10}, ${0 + i * 10}, ${0 + i * 10})`;
  }, 0);
</script>

<template>
  <tr style="animation: fadeIn .5s ease {i / 8}s forwards;">
    <div class="info info{i}">
      <td class="name">
        <span>{d.name}</span>
      </td>
      <td class="percent">
        <span>{$progress2.toFixed(2)}%</span>
      </td>
    </div>
    <td class="bar">
      <progress id="bar{i}" value={$progress} />
    </td>
  </tr>
</template>

<style>
  progress {
    width: 100%;
    appearance: none;
    -webkit-appearance: none;
    height: 35.5px;
    background-color: transparent;
  }

  progress::-moz-progress-bar {
    background-color: transparent;
  }

  progress::-webkit-progress-bar {
    background-color: transparent;
  }

  progress::-webkit-progress-value {
    background: var(--c, pink);
  }

  .info {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    margin-bottom: -30px;
    z-index: 1;
    width: 100%;
  }

  .name {
    width: 100%;
    text-align: left;
  }

  .name span {
    font-size: 14px;
    padding: 0 5px 0 10px;
    font-weight: 600;
  }

  .bar {
    padding: 0;
    height: 35px;
    float: none;
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
