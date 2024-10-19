# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json bun.lockb prisma/ ./

RUN yarn install --production
RUN yarn run prisma:generate

COPY . .

RUN yarn build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app .

CMD ["node", "./dist/index.mjs", "consume", "all"]