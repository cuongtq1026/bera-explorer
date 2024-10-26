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
- Prisma (ORM)
- Docker (Containerization)
- RabbitMQ (Message broker)
- CP Kafka (Aggregating, streaming data)
    - Kafka
    - Kafka Streams
    - Kafka Connector
    - Kafka KSQL
    - Schema Registry
- Prometheus (Monitoring)
- Winston (Logging)
- Postgres (Database)
- Redis (Caching)
- Viem (Ethereum tools)
- Next (React)
- Avro (Data serialization)

## Structures
```
.
├── Dockerfile
├── README.md
├── backend.ts
├── bera-explorer.drawio
├── docker-compose.yml
├── eslint.config.js
├── frontend # Frontend Server using Next
│    └── src
├── frontend.Dockerfile
├── index.ts
├── package.json
├── prisma
│    ├── migrations
│    └── schema.prisma
├── prometheus.yml
├── services
│    ├── api # API Server using Express
│    ├── config
│    ├── data-source # Fetching data from RPC nodes
│    ├── data-storage # Storing data
│    ├── decoder # Blockchain transactions decoders
│    ├── exceptions
│    ├── interfaces
│    ├── monitor # Logger, Prometheus
│    ├── processors # Process blockchain data and store them
│    ├── queues # Kafka and RabbitMQ
│    └── utils.ts
├── tsconfig.json
├── tsconfig.tsbuildinfo
└── yarn.lock
```


## Setup
### 1. Install dependencies
Install the project dependencies
```bash
yarn install
```
Install dependencies in frontend directory:
```bash
cd frontend && yarn install
```

Download jars and connectors
```bash
mkdir connects && cd connects

curl --output kafka-connect-jdbc-10.8.0.jar https://packages.confluent.io/maven/io/confluent/kafka-connect-jdbc/10.8.0/kafka-connect-jdbc-10.8.0.jar
curl --output postgresql-42.7.4.jar https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.4/postgresql-42.7.4.jar
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
- **CP Kafka**: Storing, aggregating, streaming data in order.
### 3. Configure Environment Variables
Copy the example environment file and update the RPC_URLS:
```bash
cp .env.example .env
```
- RPC_URLS: Comma-separated list of RPC URLs.

### 4. Generate Prisma Client
Run the following command to generate Prisma client:
```bash
yarn run prisma:generate
```

### 5. Run setup scripts
```bash
# Create kafka connectors
cd ./scripts && ./create-kafka-connectors.sh
```

## Start Services

### Start Consumers
```bash
yarn run consume:all
```

### Queue New Messages
Queue a range of blocks:
```bash
# Both need to be called

# Queue blocks to rabbitmq for indexing
yarn run queue blocks <from> <to>

# Send blockNumbers to kafka for storing references in order
yarn run send-blocks-topic <from> <to>
```

### Retry Failed Messages
There is a Dead Letter Exchange (DLX) for storing failed messages. Retry them with:
```bash
yarn run retry-queue-all
```

There are a lot more commands. Please check them in `package.json`

## Backend API
To start the backend API server:
```bash
yarn run backend:dev
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
cd frontend && yarn run dev
```

## Monitoring
### RabbitMQ:
Access the RabbitMQ management interface:
- http://localhost:15672/
### Kafka:
Access the Kafka management interface:
- http://localhost:8080/
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

# Contacts
| **Name**       | **Linkedin**                                           | Github                                   |
|----------------|--------------------------------------------------------|------------------------------------------|
| **Cuong Tran** | [LinkedIn](https://www.linkedin.com/in/cuongtran1026/) | [Github](https://github.com/cuongtq1026) |   |
