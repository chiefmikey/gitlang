<style global>
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: Arial, Helvetica, sans-serif;
  }

  #app {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 450px;
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
    padding: 14px;
    font-size: 14px;
    outline: none;
  }

  button {
    width: 50%;
    opacity: 50%;
  }

  button:hover {
    opacity: 100%;
    cursor: pointer;
  }

  input {
    width: 100%;
    font-size: 18px;
  }

  input::placeholder {
    color: black;
    opacity: 40%;
    font-size: 14px;
  }

  table {
    width: 86%;
  }

  span {
    padding: 0 10px 0 10px;
  }

  tr {
    display: flex;
    flex-direction: column;
    justify-content: center;
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

  h6 {
    font-weight: 200;
    font-size: 14px;
    margin: 0;
    padding-bottom: 20px;
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
