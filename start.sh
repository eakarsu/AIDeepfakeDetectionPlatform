#!/bin/bash

# ========================================
# AI Deepfake Detection Platform - Startup
# ========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════╗"
echo "║    AI Deepfake Detection Platform            ║"
echo "║    Trust & Safety - Enterprise Grade         ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -v '^$' | xargs)
    echo -e "${GREEN}✓ Environment variables loaded${NC}"
else
    echo -e "${RED}✗ .env file not found! Please create one.${NC}"
    exit 1
fi

BACKEND_PORT=${BACKEND_PORT:-4000}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

# Function to kill process on a port
kill_port() {
    local port=$1
    local pid=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}  Killing process on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Clean up used ports
echo -e "\n${CYAN}[1/6] Cleaning up ports...${NC}"
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT
echo -e "${GREEN}✓ Ports $BACKEND_PORT and $FRONTEND_PORT are free${NC}"

# Check PostgreSQL
echo -e "\n${CYAN}[2/6] Checking PostgreSQL...${NC}"
if command -v pg_isready &> /dev/null; then
    if pg_isready -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL is running${NC}"
    else
        echo -e "${YELLOW}⚠ PostgreSQL is not running. Attempting to start...${NC}"
        if command -v brew &> /dev/null; then
            brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
            sleep 2
        fi
        if ! pg_isready -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} > /dev/null 2>&1; then
            echo -e "${RED}✗ Could not start PostgreSQL. Please start it manually.${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ PostgreSQL started${NC}"
    fi
else
    echo -e "${YELLOW}⚠ pg_isready not found, assuming PostgreSQL is running${NC}"
fi

# Create database if not exists
echo -e "\n${CYAN}[3/6] Setting up database...${NC}"
DB_NAME=${DB_NAME:-deepfake_detection}
DB_USER=${DB_USER:-postgres}

if psql -U "$DB_USER" -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo -e "${GREEN}✓ Database '$DB_NAME' exists${NC}"
else
    echo -e "${YELLOW}  Creating database '$DB_NAME'...${NC}"
    createdb -U "$DB_USER" -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" "$DB_NAME" 2>/dev/null || \
    psql -U "$DB_USER" -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
    echo -e "${GREEN}✓ Database created${NC}"
fi

# Install dependencies
echo -e "\n${CYAN}[4/6] Installing dependencies...${NC}"
echo -e "  ${BLUE}Installing backend dependencies...${NC}"
cd "$PROJECT_DIR/backend"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}  ✓ Backend dependencies installed${NC}"

echo -e "  ${BLUE}Installing frontend dependencies...${NC}"
cd "$PROJECT_DIR/frontend"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}  ✓ Frontend dependencies installed${NC}"

cd "$PROJECT_DIR"

# Seed database
echo -e "\n${CYAN}[5/6] Seeding database...${NC}"
cd "$PROJECT_DIR/backend"
node src/seed.js
echo -e "${GREEN}✓ Database seeded successfully${NC}"
cd "$PROJECT_DIR"

# Start services with hot reload
echo -e "\n${CYAN}[6/6] Starting services with hot reload...${NC}"

# Start backend with nodemon (hot reload)
echo -e "  ${BLUE}Starting backend on port $BACKEND_PORT...${NC}"
cd "$PROJECT_DIR/backend"
npx nodemon src/server.js &
BACKEND_PID=$!
cd "$PROJECT_DIR"

# Wait for backend to start
sleep 3

# Start frontend with Vite (hot reload built-in)
echo -e "  ${BLUE}Starting frontend on port $FRONTEND_PORT...${NC}"
cd "$PROJECT_DIR/frontend"
npx vite --port $FRONTEND_PORT --host &
FRONTEND_PID=$!
cd "$PROJECT_DIR"

# Wait for frontend to start
sleep 3

echo -e "\n${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Platform is ready!                          ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║  Frontend: ${CYAN}http://localhost:$FRONTEND_PORT${GREEN}            ║${NC}"
echo -e "${GREEN}║  Backend:  ${CYAN}http://localhost:$BACKEND_PORT${GREEN}            ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║  Login:    ${YELLOW}admin@deepfake.ai${GREEN}                ║${NC}"
echo -e "${GREEN}║  Password: ${YELLOW}password123${GREEN}                      ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║  AI Model: ${PURPLE}${OPENROUTER_MODEL}${GREEN}   ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║  Hot reload is enabled for both services.    ║${NC}"
echo -e "${GREEN}║  Press Ctrl+C to stop all services.          ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"

# Cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    echo -e "${GREEN}✓ All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait
