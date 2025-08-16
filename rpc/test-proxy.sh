#!/bin/bash

# Test script for RPC Proxy
echo "Testing RPC Proxy for Transaction Delay Insurance"
echo "================================================="

# Set the network (change this to test different networks)
NETWORK=${1:-zircuit}
ENV_FILE=".env.$NETWORK"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file $ENV_FILE not found"
    echo "Available networks: zircuit, flow, hedera"
    exit 1
fi

echo "Using network configuration: $NETWORK"
echo "Environment file: $ENV_FILE"

# Copy the environment file
cp "$ENV_FILE" .env

echo "Installing dependencies..."
npm install

echo ""
echo "Starting RPC Proxy server..."
echo "Press Ctrl+C to stop"
echo ""

# Start the server
npm start
