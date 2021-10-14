<script>
  import Styles from './Styles.svelte';
  import axios from 'axios';
  import Progress from './Progress.svelte';

  let owner = '';
  let data;

  const getData = async (owner) => {
    try {
      const res = await axios.get(
        `http://localhost:3000/languages?owner=${owner}`,
      );
      return res.data;
    } catch (e) {
      return e;
    }
  };

  const submit = async () => {
    const collectData = [];
    const allData = await getData(owner);
    const keys = Object.keys(allData);
    for (let i = 0; i < keys.length; i += 1) {
      collectData.push({ name: [keys[i]], percent: allData[keys[i]] });
    }
    collectData.sort((a, b) => b.percent - a.percent);
    data = collectData;
    owner = '';
  };
</script>

<template>
  <Styles />
  <h1>Profile Languages</h1>

  <h6>
    View language usage from all public repositories of a GitHub user profile
  </h6>

  <input bind:value={owner} placeholder="GitHub Username" />
  <button on:click={submit}>Submit</button>

  {#if data}
    <div id="results">
      <table>
        <tbody>
          {#if data.length > 0}
            {#each data as d}
              <Progress {d} />
            {/each}
          {:else}
            <h4>User Not Found</h4>
          {/if}
        </tbody>
      </table>
    </div>
  {/if}
</template>

<style>
</style>
