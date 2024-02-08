<script>
  export let langCount;
  export let repoCount;
  export let currentOwner;
  export let data;

  const url = `https://github.com/${currentOwner}`;
</script>

<template>
  <div id="card">
    {#if currentOwner}
      <a
        id="owner"
        href={url}>{currentOwner}
      </a>
    {/if}
    {#if data && data.length > 0}
      {#if repoCount || langCount}
        <div id="counts">
          {#if langCount}
            <span id="lang">Langs: {langCount}</span>
          {/if}
          {#if repoCount}
            <span id="repos">Repos: {repoCount}</span>
          {/if}
        </div>
      {/if}
    {:else}
      <h5 id="loading">Loading...</h5>
    {/if}
  </div>
</template>

<style>
#card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #e8e6e2;
}

#owner {
  font-size: 20px;
  padding: 10px 10px 10px 10px;
  margin-bottom: 12px;
  animation: fadeIn 0.1s ease 0s forwards;
  border-bottom: 1px solid #e8e6e2;
  color: #e8e6e2;
}
#counts {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding-bottom: 15px;
}

#repos,
#lang {
  font-size: 15px;
  animation: fadeIn 0.1s ease 0s forwards;
}
</style>
