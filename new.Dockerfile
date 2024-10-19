# Build stage
FROM node:lts

WORKDIR /app

COPY package.json yarn.lock prisma/ ./

RUN yarn install
RUN yarn run prisma:generate

CMD ["yarn", "run", "consume:all"]