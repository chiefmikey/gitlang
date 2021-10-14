<script>
  import Styles from './Styles.svelte';
  import axios from 'axios';
  import Progress from './Progress.svelte';
  import Card from './Card.svelte';

  let owner = '';
  let currentOwner = '';
  let data;
  let langCount;
  let repoCount;
  let placeholder = '[ GitHub Username ]';

  const getData = async (owner) => {
    try {
      const res = await axios.get(`/languages?owner=${owner}`);
      return res.data;
    } catch (e) {
      return e;
    }
  };

  const submit = async (e) => {
    if (!e.key || e.key === 'Enter') {
      e.target.blur();
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
          collectData.push({ name: [keys[i]], percent: allData.size[keys[i]] });
        }
        collectData.sort((a, b) => b.percent - a.percent);
        data = collectData;
      }
    }
  };
</script>

<template>
  <Styles />
  <h1>Profile Languages</h1>

  <h6>
    View language usage from all public repositories of a GitHub user profile
  </h6>

  <input
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
        <tbody>
          {#if data.length > 0}
            {#each data as d, i}
              <Progress {d} {i} />
            {/each}
          {:else}
            <h5>User Not Found</h5>
          {/if}
        </tbody>
      </table>
    {/if}
  </div>
</template>

<style>
  #results {
    width: 100%;
    height: 100%;
    padding: 20px 0 40px 0;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
</style>
