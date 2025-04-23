FROM oven/bun:latest

WORKDIR /auth

COPY bun.lockb .
COPY package.json .

RUN bun install

COPY . .

ENTRYPOINT ["bun", "start"]