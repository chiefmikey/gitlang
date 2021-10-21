<style global>
  html {
    background-color: #232323;
  }

  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: Arial, Helvetica, sans-serif;
    min-width: 250px;
    min-height: 450px;
    padding: 0;
    margin: 0;
    color: #e8e6e2;
    background-color: #232323;
    height: 100%;
    width: 100%;
  }

  #app {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 450px;
    min-width: 250px;
    overflow: hidden;
  }

  @media (orientation: landscape) {
    #app {
      transform: scale(1);
      transform-origin: top;
    }
  }

  @media (min-width: 560px), (min-height: 960px) {
    #app {
      transform: scale(1.3);
      transform-origin: top;
    }
  }

  @media (min-width: 1900px), (min-height: 960px) {
    #app {
      transform: scale(1.8);
      transform-origin: top;
    }
  }

  a {
    text-decoration: none;
    color: #232323;
  }

  input,
  button {
    border: none;
    box-sizing: border-box;
    text-align: center;
    padding: 10px;
    font-size: 14px;
    outline: none;
  }

  button {
    width: 135px;
    height: 35px;
    background-color: #e8e6e2;
    color: #232323;
  }

  button:hover {
    cursor: pointer;
  }

  input {
    width: 100%;
    min-width: 150px;
    font-size: 18px;
    background: none;
    color: #e8e6e2;
  }

  input::placeholder {
    font-size: 14px;
    color: #e8e6e2;
  }

  table {
    width: 101.25%;
  }

  span {
    padding: 0 10px 0 10px;
  }

  tr {
    display: flex;
    flex-direction: column;
    justify-content: center;
    opacity: 0%;
    overflow: hidden;
    height: 50px;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    text-align: center;
  }

  h1 {
    margin-top: 50px;
    font-size: 44px;
    width: 100%;
    line-height: 10px;
  }

  h4 {
    font-size: 16px;
  }

  h5 {
    font-weight: 200;
    font-size: 12px;
    margin: 0;
    padding: 0 20px 20px 20px;
  }

  h6 {
    font-weight: 200;
    font-size: 10px;
    margin: 0;
    padding: 10px 20px 40px 20px;
  }

  h6 a {
    color: #fe9fc9;
  }

  @keyframes fadeIn {
    from {
      opacity: 0%;
    }

    to {
      opacity: 100%;
    }
  }
</style>
