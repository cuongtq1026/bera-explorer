# Build stage
FROM oven/bun:latest as builder

WORKDIR /app

COPY package.json bun.lockb prisma/ ./

RUN bun install
RUN bun run prisma:generate

COPY . .

RUN bun build ./index.ts --outdir ./build --target bun

# Production stage
FROM oven/bun:latest

WORKDIR /app

COPY --from=builder /app/node_modules/.prisma/client/libquery_engine-linux-arm64-openssl-1.1.x.so.node ./
COPY --from=builder /app/build ./build

CMD ["bun", "run", "./build/index.js", "consume", "all"]