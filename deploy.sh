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

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting deployment process...${NC}"

# Build the production image
echo -e "${GREEN}Building production Docker image...${NC}"
docker compose build prod

# Tag and push the image
echo -e "${GREEN}Pushing image to Docker registry...${NC}"
docker push ${DOCKER_REGISTRY}/${APP_NAME}:${VERSION}

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

echo "Deployment completed successfully!"
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
