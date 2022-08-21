# Contributing to GitLang

## Local development

### API Authentication

Create a GitHub Personal Access Token (PAT) with the `public_repo` scope.

Create a `.env` file in the root of the project with the following contents:

```env
GITHUB_PAT=<your PAT>
```

Make sure the `.env` file is not tracked in Git.

### Install Dependencies

```sh
npm install
```

### Build

#### Development

```sh
npm run dev
```

#### Production

```sh
npm run prod
```

### Start Server

```sh
npm run start:server
```

### Start Client

```sh
npm run start:client
```

The client will be available on local port `8080`.
