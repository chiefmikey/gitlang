<script>
  setTimeout(() => {
    const button = document.getElementById('scroll-top');
    button.style = 'animation: fadeIn .5s ease-out 0s forwards;';
  }, 0);

  const scroll = () => {
    window.scroll({ top: 0, behavior: 'smooth' });
  };
</script>

<template>
  <div id="scroll-top" on:click={scroll}><h6>[ top ]</h6></div>
</template>

<style>
  #scroll-top {
    cursor: pointer;
    right: 50%;
    z-index: 2;
    width: 100px;
    height: 30px;
    opacity: 0%;
  }
</style>
