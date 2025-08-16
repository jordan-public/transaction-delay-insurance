#!/bin/bash

# Transaction Delay Insurance Frontend Setup Script

echo "🚀 Setting up Transaction Delay Insurance Frontend"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="16.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is not supported. Please install Node.js 16+ first."
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create environment file
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
    echo "⚠️  Please update .env with your actual values:"
    echo "   - REACT_APP_WALLETCONNECT_PROJECT_ID"
    echo "   - Contract addresses for each network"
else
    echo "⚠️  .env file already exists"
fi

# Check if RPC proxy is running
echo ""
echo "🔍 Checking RPC Proxy status..."

check_proxy() {
    local port=$1
    local network=$2
    
    if curl -s "http://localhost:$port/health" > /dev/null; then
        echo "✅ $network RPC Proxy (port $port) is running"
        return 0
    else
        echo "❌ $network RPC Proxy (port $port) is not running"
        return 1
    fi
}

proxy_status=0

check_proxy 3001 "Zircuit" || proxy_status=1
check_proxy 3002 "Flow" || proxy_status=1  
check_proxy 3003 "Hedera" || proxy_status=1

if [ $proxy_status -ne 0 ]; then
    echo ""
    echo "⚠️  Some RPC proxies are not running."
    echo "    Please start them from the ../rpc directory:"
    echo "    - bash test-proxy.sh zircuit"
    echo "    - bash test-proxy.sh flow"
    echo "    - bash test-proxy.sh hedera"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your actual values"
echo "2. Ensure RPC proxy servers are running"
echo "3. Deploy contracts and update addresses in config"
echo "4. Start the development server: npm start"
echo ""
echo "🌐 The app will be available at: http://localhost:3000"
