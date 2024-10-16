# Bera Explorer

**Bera Explorer** is a blockchain explorer composed of three main services:
- **Crawler**: Retrieves data from RPC nodes and stores it in a relational database (Postgres).
- **API Server**: Serves the stored data through a REST API (Express).
- **Web Client**: Provides a user interface to interact with the API (Next).

## Data Model
- [x] **Block**
- [x] **Transaction**
- [x] **Transaction Receipt**
- [x] **Log**
- [x] **Log Topic**
- [x] **Internal Transaction**
- [x] **Transfer**
- [x] **Balance**
- [x] **Balance history**
- [x] **Swap**
- [x] **Token**
- [x] **Token USD Price**
- [ ] **Token BTC Price**
- [ ] **Token ETH Price**


## Technologies
The project uses the following technologies:
- [Bun](https://bun.sh) (JavaScript runtime)
- Prisma (ORM)
- Docker (Containerization)
- RabbitMQ (Message broker)
- Kafka (Aggregate data)
- Prometheus (Monitoring)
- Winston (Logging)
- Postgres (Database)
- Redis (Caching)
- Viem (Ethereum tools)
- Next (React)

## Setup
### 1. Install dependencies
Install the project dependencies using [Bun](https://bun.sh):
```bash
bun install
```
Install dependencies in frontend directory:
```bash
cd frontend && bun install
```

### 2. Run docker-compose:
Start the necessary services with Docker Compose:
```bash
docker-compose up -d
```
The following services will be started:

- **Postgres** DB: Stores blocks and transactions.
- **Redis**: Caching layer.
- **RabbitMQ**: Manages message queues between producers and consumers for processing blocks, transactions, transactions-receipts, internal-transactions, transfers.
- **Prometheus**: Monitors metrics such as RPC node requests, error rates, and message processing success rates.
- **Kafka (No zookeeper included)**: Aggregates data from transfers to balances.
- **Kafka UI**: Provides a web interface for viewing Kafka brokers, topics and consumers.
### 3. Configure Environment Variables
Copy the example environment file and update the RPC_URLS:
```bash
cp .env.example .env
```
- RPC_URLS: Comma-separated list of RPC URLs.

### 4. Generate Prisma Client
Run the following command to generate Prisma client:
```bash
bun run prisma:generate
```

## Start Services

### Start Consumers
```bash
bun run consume:all
```

### Queue New Messages
Queue a block for processing:
```bash
bun run queue block <blockNumber>
```
Queue a range of blocks:
```bash
bun run queue blocks <from> <to>
```
Queue a transaction for processing:
```bash
bun run queue transaction <txHash>
```
Note: Transactions will be automatically queued after a block is processed. Once a transaction is processed, a `transaction-receipt` message will be published._

### Retry Failed Messages
There is a Dead Letter Exchange (DLX) for storing failed messages. Retry them with:
```bash
bun run retry-queue-all
```

## Backend API
To start the backend API server:
```bash
bun run dev
```

### API Endpoints
- `GET /block/:blockNumber`: Fetch a block by its number.
Query Params: `withTransactions?: boolean`

- `GET /transaction/:txHash`: Fetch a transaction by its hash.
Query Params: `withReceipt?: boolean`

- `GET /blocks`: Fetch a list of blocks.
Query Params: `page?: number, size?: number, cursor?: number, order?: "asc" | "desc"`

- `GET /block/:blockNumber/transactions`: Fetch transactions within a block.
Query Params: `page?: number, size?: number, cursor?: number, order?: "asc" | "desc"`

## UI
To start the UI server:
```bash
cd frontend && bun run dev
```

## Monitoring
### RabbitMQ:
Access the RabbitMQ management interface:
- http://localhost:15672/
### Kafka:
Access the Kafka management interface:
- http://localhost:9021/
### Prometheus
Access the Prometheus dashboard:
- http://localhost:9090/
### Logs:
All logs are stored in the logs directory.

# Docker
To build the Docker image for the root project (Includes crawler and API server):
```bash
docker build -t bera-explorer .
```
To build frontend image:
```bash
docker build -t bera-explorer-frontend -f frontend.Dockerfile --build-arg DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public" .
```