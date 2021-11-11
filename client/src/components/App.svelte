<script>
  import { onMount } from 'svelte';
  import axios from 'axios';
  import Styles from './Styles.svelte';
  import Progress from './Progress.svelte';
  import Card from './Card.svelte';
  import ScrollTop from './ScrollTop.svelte';

  let owner = '';
  let currentOwner = '';
  let data;
  let langCount;
  let repoCount;
  let placeholder = '[ GitHub Username ]';
  let done = false;

  onMount(async () => {
    const windowOwner = `${window.location.pathname.split('/')[1]}`;
    if (windowOwner && windowOwner.length > 0) {
      currentOwner = windowOwner;
      owner = windowOwner;
      await submit('window');
    }
  });

  const isDone = () => {
    done = true;
  };

  const getData = async (owner) => {
    try {
      const response = await axios.get(`/languages?owner=${owner}`);
      return response.data;
    } catch (error) {
      return error;
    }
  };

  const submit = async (event) => {
    try {
      if (event === 'window' || !event.key || event.key === 'Enter') {
        if (event !== 'window') {
          event.target.blur();
        }
        done = false;
        data = undefined;
        langCount = undefined;
        repoCount = undefined;
        currentOwner = owner;
        if (event === window) {
          owner = '';
        }
        const collectData = [];
        const allData = await getData(currentOwner);
        if (allData.names) {
          repoCount = allData.names.length;
        }
        // eslint-disable-next-line unicorn/explicit-length-check
        if (allData.size) {
          const keys = Object.keys(allData.size);
          langCount = keys.length;
          for (const key of keys) {
            collectData.push({ name: key, percent: allData.size[key] });
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
  <Styles />

  <img id="logo" src="../assets/img/gitlang.svg" alt="GitLang logo" />

  <h5>
    View language usage across all<br />public repositories of a GitHub profile
  </h5>

  <input
    tabindex="0"
    id="search"
    type="text"
    bind:value={owner}
    {placeholder}
    on:focus={() => {
      placeholder = '';
    }}
    on:blur={() => {
      placeholder = '[ GitHub Username ]';
    }}
    on:keydown={submit}
    autocorrect="off"
    autocapitalize="none"
  />

  <button on:click={submit}>Submit</button>

  <div id="results">
    {#if currentOwner}
      <Card {langCount} {repoCount} {currentOwner} {data} />
    {/if}
    {#if data}
      <table>
        <tbody id="tbody">
          {#if data.length > 0}
            {#each data as d, i}
              <Progress {d} {i} {langCount} {isDone} />
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
  #results {
    height: 100%;
    width: 100%;
    padding: 20px 0 10px 0;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
</style>
