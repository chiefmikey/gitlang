<script>
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
  <h1>Profile Languages</h1>

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

<style global>
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: Arial, Helvetica, sans-serif;
  }

  #app {
    width: 40px;
    height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  input,
  button {
    width: 400px;
    border: none;
    box-sizing: border-box;
    text-align: center;
    padding: 14px;
    font-size: 14px;
    outline: none;
  }

  button {
    opacity: 50%;
  }

  button:hover {
    opacity: 100%;
  }

  input {
    font-size: 18px;
  }

  span {
    padding: 0 10px 0 10px;
  }

  tr {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  h1 {
    text-align: center;
    font-size: 30px;
    white-space: nowrap;
    padding: 40px 0 20px 0;
  }

  h4 {
    font-size: 16px;
    white-space: nowrap;
  }

  #results {
    padding: 40px 0 40px 0;
    text-align: center;
  }
</style>
