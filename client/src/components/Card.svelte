<script>
  export let count1;
  export let count2;
  export let current;
  export let data;

  const url = `https://github.com/${current}`;
</script>

<template>
  <div class="card">
    {#if current}
      <a
        class="owner"
        href={url}>{current}
      </a>
    {/if}
    {#if data && data.length > 0}
      {#if count2 || count1}
        <div class="counts">
          {#if count1}
            <span class="lang">Langs: {count1}</span>
          {/if}
          {#if count2}
            <span class="repos">Repos: {count2}</span>
          {/if}
        </div>
      {/if}
    {:else}
      <h5>Loading...</h5>
    {/if}
  </div>
</template>

<style>
.card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #e8e6e2;
}

.owner {
  font-size: 1.2rem;
  padding: 2rem 0 .6rem 0;
  margin-bottom: 12px;
  animation: fade-in 0.1s ease 0s forwards;
  border-bottom: 1px solid #e8e6e2;
  color: #e8e6e2;
}

.counts {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding-bottom: 15px;
}

.repos,
.lang {
  font-size: 15px;
  animation: fade-in 0.1s ease 0s forwards;
}
</style>
