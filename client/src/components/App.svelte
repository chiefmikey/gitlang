<script>
  import Styles from './Styles.svelte';
  import axios from 'axios';
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

  const isDone = () => {
    done = true;
  };

  const getData = async (owner) => {
    try {
      const res = await axios.get(`/languages?owner=${owner}`);
      return res.data;
    } catch (e) {
      return e;
    }
  };

  const submit = async (e) => {
    try {
      if (!e.key || e.key === 'Enter') {
        e.target.blur();
        done = false;
        data = undefined;
        langCount = undefined;
        repoCount = undefined;
        currentOwner = owner;
        owner = '';
        const collectData = [];
        const allData = await getData(currentOwner);
        if (allData.names) {
          repoCount = allData.names.length;
        }
        if (allData.size) {
          const keys = Object.keys(allData.size);
          langCount = keys.length;
          for (let i = 0; i < keys.length; i += 1) {
            collectData.push({ name: keys[i], percent: allData.size[keys[i]] });
          }
          collectData.sort((a, b) => b.percent - a.percent);
          data = collectData;
        }
      }
    } catch (e) {
      return e;
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
    width: 100%;
    height: 100%;
    padding: 20px 0 10px 0;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
</style>
