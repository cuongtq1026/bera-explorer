# bera-explorer

To install dependencies:

```bash
bun install
```

To start all consumers:

```bash
bun run consume:all
```

To queue a new message to the consumer:
```bash
bun run queue-block <blockNumber>
bun run queue-transaction <txHash>
```

Building docker image:
```bash
docker build -t bera-explorer .
```

This project was created using `bun init` in bun v1.1.22. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
