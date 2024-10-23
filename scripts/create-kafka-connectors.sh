#!/bin/bash

# Create connectors defined in connectors.json
for connector in ../config/kafka-connectors/*.json; do
  echo "Creating connector from $connector"
  curl -X POST -H "Content-Type: application/json" --data @"$connector" http://localhost:8083/connectors
done
