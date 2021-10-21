<script>
  import { tweened } from 'svelte/motion';
  import { cubicOut, cubicInOut } from 'svelte/easing';

  export let d;
  export let i;
  export let langCount;

  let currentPercent = 0;
  let finalPercent = Number((d.percent * 100).toFixed(2));
  let data;
  let speed = 80 * (i + 1) + 250;

  const progress = tweened(0, {
    duration: 1000,
    easing: cubicInOut,
  });

  const progress2 = tweened(0, {
    duration: 1000,
    easing: cubicInOut,
  });

  const setProgress = (perc) => {
    if (perc < 0.003) {
      return 0.003;
    }
    return perc;
  };

  setTimeout(() => ($progress = setProgress(d.percent)), speed);
  setTimeout(() => ($progress2 = finalPercent), speed);
  setTimeout(() => {
    const prog = document.getElementById(`bar${i}`);
    const info = document.getElementsByClassName(`info${i}`);
    prog.style.setProperty(
      '--c',
      `rgb(${255 - (255 / langCount) * i}, ${
        160 - (160 / langCount) * i
      }, ${203})`,
    );
    info[0].style.color = `rgb(${275 - (225 / langCount) * i}, ${
      275 - (225 / langCount) * i
    }, ${275 - (225 / langCount) * i})`;
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
    height: 104%;
    background-color: transparent;
  }

  progress::-moz-progress-bar {
    background-color: transparent;
  }

  progress::-webkit-progress-bar {
    background-color: transparent;
  }

  progress::-webkit-progress-value {
    background: var(--c, #fe9fc9);
  }

  .info {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    margin-bottom: -37px;
    z-index: 1;
    width: 100%;
    height: 37px;
  }

  .name {
    width: 100%;
    text-align: left;
    padding: 0;
  }

  .name span {
    font-size: 16px;
    padding: 0 5px 0 10px;
    font-weight: 600;
  }

  .bar {
    padding: 0;
    height: 50px;
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
