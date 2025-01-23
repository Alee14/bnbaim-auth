# bnbaim-discord-auth
Web authentication for AIM (registering accounts, changing passwords) using Discord authentication.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.js
```

# How this works?
The website requires to log into Discord, and it checks if the user is on a specific server (as defined on the .env file). Then it checks if the user is registered on a local database, if not then it prompts the user to register a FreeSO account. After, once the user registers the account, it makes a POST request to `/userapi/registration`. Otherwise, if the user is registered, then it redirects the user to the dashboard which has options to change the password and download the client.

This project was created using `bun init` in bun v1.1.38. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
