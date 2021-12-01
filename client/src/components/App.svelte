<script>
import { onMount } from 'svelte';

import langs from '../../routes/index.js';

import Card from './Card.svelte';
import Progress from './Progress.svelte';
import ScrollTop from './ScrollTop.svelte';

let owner = '';
let currentOwner = '';
let data;
let langCount;
let repoCount;
let placeholder = '[ username / repo ]';
let done = false;
let url = false;

onMount(async () => {
  const windowOwner = `${window.location.pathname
    .split('/')
    .slice(1, 3)
    .join('/')}`;
  if (windowOwner && windowOwner.length > 0) {
    console.log('windowOwner', windowOwner);
    console.log('pathname', window.location.pathname);
    console.log('split', window.location.pathname.split('/'));
    console.log('splice', window.location.pathname.split('/').slice(1, 3));
    owner = windowOwner;
    url = true;
    await submit('window');
  }
});

const isDone = () => {
  done = true;
};

const getData = async (owner) => {
  try {
    const response = await langs(owner);
    return response.data;
  } catch (error) {
    return error;
  }
};

const submit = async (event) => {
  try {
    if (
      (event === 'window' || !event.key || event.key === 'Enter') &&
      owner.length > 0
    ) {
      if (event !== 'window') {
        event.target.blur();
      }
      done = false;
      data = undefined;
      langCount = undefined;
      repoCount = undefined;
      currentOwner = owner.replaceAll(' ', '');
      owner = '';
      const collectData = [];
      const allData = await getData(currentOwner);
      if (allData.names) {
        repoCount = allData.names.length;
      }
      if (allData.space) {
        const keys = Object.keys(allData.space);
        langCount = keys.length;
        for (const key of keys) {
          collectData.push({ name: key, percent: allData.space[key] });
        }
        collectData.sort((a, b) => b.percent - a.percent);
        data = collectData;
      }
    }
    return true;
  } catch (error) {
    return error;
  }
};
</script>

<template>
  {#if !url}
    <h5>
      View language usage in<br />public repositories on GitHub
    </h5>
    <div id="input-area">
      <input
        tabindex="0"
        id="search"
        type="text"
        bind:value="{owner}"
        placeholder="{placeholder}"
        on:focus="{() => {
          placeholder = '';
        }}"
        on:blur="{() => {
          placeholder = '[ username / repo ]';
        }}"
        on:keydown="{submit}"
        autocorrect="off"
        autocapitalize="none"
      />
      <button on:click="{submit}">Submit</button>
    </div>
  {/if}
  <div id="results">
    {#if currentOwner}
      <Card
        langCount="{langCount}"
        repoCount="{repoCount}"
        currentOwner="{currentOwner}"
        data="{data}"
      />
    {/if}
    {#if data}
      <table>
        <tbody id="tbody">
          {#if data.length > 0}
            {#each data as dat, index}
              <Progress
                dat="{dat}"
                index="{index}"
                langCount="{langCount}"
                isDone="{isDone}"
              />
            {/each}
          {:else}
            <h4>User Not Found</h4>
          {/if}
        </tbody>
      </table>
    {/if}
  </div>
  {#if done}
    <ScrollTop />
  {/if}
  <h6 id="footer">
    <a href="https://github.com/chiefmikey" target="_blank"
      >made by chiefmikey</a
    >
  </h6>
</template>

<style>
#input-area {
  padding-bottom: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

#results {
  width: 100%;
  padding: 0 0 10px 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
