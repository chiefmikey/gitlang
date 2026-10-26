<script>
  import { capture } from '../lib/analytics';

  const url = "https://github.com/chiefmikey";
</script>

<template>
  <footer class="footer">
    <a
      href={url}
      on:click={() => capture('author_link_clicked')}
      rel="noopener noreferrer"
      target="_blank"
    >made by Chief Mikey</a>
  </footer>
</template>

<style>
  .footer {
    padding-bottom: 2rem;
    color: #fe9fc9;
    font-size: .6rem;
  }

  .footer a {
    text-decoration: none;
    color: inherit;
  }

  .footer a:hover {
    color: inherit;
  }
</style>
