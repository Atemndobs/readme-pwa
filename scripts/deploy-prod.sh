#!/bin/bash

# Exit on error
set -e

# Configuration
DOCKER_REGISTRY="atemnbobs"
APP_NAME="readme-pwa"
VERSION="v0.0.3"
CONTAINER_NAME="readme-pwa"
SSH_HOST="cloud.atemkeng.de"
SSH_USER="root"
DEPLOY_DIR="/root/apps/readme-pwa"
PROD_URL="https://tts.cloud.atemkeng.de"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting production deployment process...${NC}"

# Build production image
echo -e "${GREEN}Building production Docker image...${NC}"
docker buildx build \
  --platform linux/amd64 \
  --target runner \
  --build-arg NEXT_PUBLIC_API_URL=$PROD_URL \
  -t $DOCKER_REGISTRY/$APP_NAME:latest \
  -t $DOCKER_REGISTRY/$APP_NAME:$VERSION \
  --push \
  ..

# Create deployment script for the server
cat << 'EOF' > deploy-server.sh
#!/bin/bash
set -e

# Configuration
DEPLOY_DIR="/root/apps/readme-pwa"
CONTAINER_NAME="readme-pwa"

# Create deploy directory if it doesn't exist
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# Pull the latest docker-compose.yml if it exists
if [ -f "docker-compose.yml" ]; then
    echo "Backing up existing docker-compose.yml..."
    cp docker-compose.yml docker-compose.yml.backup
fi

# Download the latest docker-compose.yml
echo "Downloading latest docker-compose.yml..."
wget -O docker-compose.yml https://raw.githubusercontent.com/Atemndobs/readme-pwa/main/docker-compose.yml

# Pull the latest image
echo "Pulling latest Docker image..."
docker compose pull prod

# Stop and remove existing container
if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    echo "Stopping existing container..."
    docker compose down
fi

# Start the new container
echo "Starting new container..."
docker compose up -d prod

# Clean up old images
echo "Cleaning up old images..."
docker image prune -f

# Check container health
echo "Checking container health..."
for i in {1..6}; do
    if curl -s http://localhost:3007/api/health > /dev/null; then
        echo "Application is healthy!"
        exit 0
    fi
    echo "Waiting for application to become healthy... ($i/6)"
    sleep 10
done

echo "Warning: Application health check failed!"
exit 1
EOF

# Make the server script executable
chmod +x deploy-server.sh

# Copy the deployment script to the server
echo -e "${GREEN}Copying deployment script to server...${NC}"
scp deploy-server.sh ${SSH_USER}@${SSH_HOST}:${DEPLOY_DIR}/

# Execute the deployment script on the server
echo -e "${GREEN}Executing deployment script on server...${NC}"
ssh ${SSH_USER}@${SSH_HOST} "cd ${DEPLOY_DIR} && ./deploy-server.sh"

# Clean up local deployment script
rm deploy-server.sh

echo -e "${GREEN}Deployment completed successfully!${NC}"

# Show application URL
echo -e "${YELLOW}Application is now available at: ${GREEN}$PROD_URL${NC}"
