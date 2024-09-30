# Build stage
FROM oven/bun:latest as builder

# Define build arguments
ARG DATABASE_URL

# Set environment variables
ENV NODE_ENV=production

WORKDIR /app

COPY package.json bun.lockb prisma ./
COPY frontend/package.json frontend/bun.lockb ./frontend/

RUN bun install
RUN bun run prisma:generate

COPY . .

WORKDIR /app/frontend
RUN bun install

COPY frontend ./

RUN bun run build

EXPOSE 8000
CMD ["bun", "run", "start", "-p", "8000"]