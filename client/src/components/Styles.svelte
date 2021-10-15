<style global>
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: Arial, Helvetica, sans-serif;
    min-width: 250px;
    min-height: 450px;
    padding: 0;
    margin: 0;
  }

  #app {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 450px;
    overflow: hidden;
  }

  a {
    text-decoration: none;
    color: black;
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
    color: black;
    background-color: gainsboro;
  }

  button:hover {
    cursor: pointer;
  }

  input {
    width: 100%;
    min-width: 150px;
    font-size: 18px;
  }

  input::placeholder {
    color: gray;
    font-size: 14px;
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
    font-size: 30px;
    padding: 20px 0 0 0;
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
    padding: 10px 20px 10px 20px;
  }

  h6 a {
    color: pink;
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
