#!/bin/bash

# Exit on error
set -e

# Configuration
APP_NAME="readme-pwa"
APP_DIR="/home/atem/docker/readme-pwa"
PROD_URL="https://tts.cloud.atemkeng.de"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting production deployment process...${NC}"

# Function to get current version from docker-compose.yml
get_current_version() {
    local version=$(grep -oP "image: ${APP_NAME}:\K[0-9]+\.[0-9]+\.[0-9]+" ${APP_DIR}/docker-compose.yml)
    echo $version
}

# Function to increment version
increment_version() {
    local version=$1
    local major minor patch
    IFS='.' read -r major minor patch <<< "$version"
    patch=$((patch + 1))
    echo "${major}.${minor}.${patch}"
}

# Pull latest changes from production
echo -e "${GREEN}Pulling latest changes...${NC}"
git fetch origin main
if ! git pull origin main; then
    echo -e "${YELLOW}Pull failed, resetting branch...${NC}"
    git reset --hard origin/main
    git pull origin main
fi

# Get current version and calculate new version
CURRENT_VERSION=$(get_current_version)
NEW_VERSION=$(increment_version $CURRENT_VERSION)
echo -e "${GREEN}Current version: ${CURRENT_VERSION}${NC}"
echo -e "${GREEN}New version: ${NEW_VERSION}${NC}"

# Build production image locally
echo -e "${GREEN}Building production Docker image...${NC}"
docker buildx build \
  --platform linux/amd64 \
  --target runner \
  --build-arg NEXT_PUBLIC_API_URL=$PROD_URL \
  -t $APP_NAME:$NEW_VERSION \
  --load \
  ${APP_DIR}

# Update docker-compose.yml with new version
echo -e "${GREEN}Updating docker-compose.yml...${NC}"
sed -i "s/${APP_NAME}:${CURRENT_VERSION}/${APP_NAME}:${NEW_VERSION}/" ${APP_DIR}/docker-compose.yml

# Stop and remove existing container
echo -e "${GREEN}Cleaning up existing containers...${NC}"
docker stop ${APP_NAME} || true
docker rm ${APP_NAME} || true

# Deploy with docker-compose
echo -e "${GREEN}Deploying new version...${NC}"
cd ${APP_DIR}
docker-compose up -d --force-recreate

# Check container health
echo -e "${GREEN}Checking container health...${NC}"
for i in {1..6}; do
    if curl -s http://localhost:3007/api/health > /dev/null; then
        echo -e "${GREEN}Application is healthy!${NC}"
        exit 0
    fi
    echo "Waiting for application to become healthy... ($i/6)"
    sleep 10
done

echo -e "${YELLOW}Warning: Application health check failed!${NC}"
exit 1
