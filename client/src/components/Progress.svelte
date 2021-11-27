<script>
import { cubicInOut } from 'svelte/easing';
import { tweened } from 'svelte/motion';

export let dat;
export let index;
export let langCount;
export let isDone;

const finalPercent = Number((dat.percent * 100).toFixed(2));
const speed = (index / 8) * 1000 + 222;

const progress = tweened(0, {
  duration: 1400,
  easing: cubicInOut,
});

const progress2 = tweened(0, {
  duration: 1400,
  easing: cubicInOut,
});

const setProgress = (perc) => {
  if (perc < 0.003) {
    return 0.003;
  }
  return perc;
};

setTimeout(() => ($progress = setProgress(dat.percent)), speed);
setTimeout(() => {
  $progress2 = finalPercent;
  if (index === langCount - 1) {
    isDone();
  }
}, speed);
setTimeout(() => {
  const prog = document.querySelector(`#bar${index}`);
  const info = document.querySelector(`.info${index}`);
  prog.style.setProperty(
    '--c',
    `rgb(${255 - (255 / langCount) * index}, ${
      160 - (160 / langCount) * index
    }, ${203})`,
  );
  console.log(info);

  info.style.color = `rgb(${275 - (225 / langCount) * index}, ${
    275 - (225 / langCount) * index
  }, ${275 - (225 / langCount) * index})`;
}, 0);
</script>

<template>
  <tr
    id="row{index}"
    style="animation: fadeInHeight .5s ease-out {index / 8}s forwards;"
  >
    <div class="info info{index}">
      <td class="name">
        <span>{dat.name}</span>
      </td>
      <td class="percent">
        <span>{$progress2.toFixed(2)}%</span>
      </td>
    </div>
    <td class="bar">
      <progress id="bar{index}" value="{$progress}"></progress>
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
  white-space: nowrap;
  overflow: hidden;
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
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  height: 18px;
  padding: 0 10px 0 10px;
}

.percent span {
  font-size: 12px;
  padding: 0;
}
</style>
