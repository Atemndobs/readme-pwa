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
CURRENT_VERSION=$(grep -oP "image: ${APP_NAME}:\K[0-9]+\.[0-9]+\.[0-9]+" docker-compose.yml || echo "1.0.0")
MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
PATCH=$(echo $CURRENT_VERSION | cut -d. -f3)
NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
echo -e "${GREEN}Current version: ${CURRENT_VERSION}${NC}"
echo -e "${GREEN}New version: ${NEW_VERSION}${NC}"

# Update version files
echo -e "${GREEN}Updating version files...${NC}"

# Create required directories
mkdir -p src/utils

# Update version file
echo "// This file is automatically updated during deployment
export const APP_VERSION = '${NEW_VERSION}';" > src/utils/version.ts

# Get the latest git log message for changelog
LATEST_CHANGES=$(git log -1 --pretty=%B | sed 's/["\]/\\&/g' | tr '\n' ' ')
TODAY_DATE=$(date +%Y-%m-%d)

# Create new changelog entry
cat > src/utils/changelog.ts << EOL
import { APP_VERSION } from './version'

export type VersionInfo = {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: Record<string, VersionInfo> = {
  [APP_VERSION]: {
    version: APP_VERSION,
    date: '${TODAY_DATE}',
    changes: [
      '${LATEST_CHANGES}'
    ]
  },
  ['${CURRENT_VERSION}']: {
    version: '${CURRENT_VERSION}',
    date: '${TODAY_DATE}',
    changes: [
      'Previous stable version'
    ]
  }
}

export const getVersionInfo = (version: string): VersionInfo | undefined => {
  return CHANGELOG[version]
}

export const getCurrentVersion = () => APP_VERSION
export const getPreviousVersionInfo = () => CHANGELOG['${CURRENT_VERSION}']
EOL

# Update docker-compose.yml with new version
sed -i.bak "s/${APP_NAME}:${CURRENT_VERSION}/${APP_NAME}:${NEW_VERSION}/" docker-compose.yml
rm -f docker-compose.yml.bak

# If we're not in the production directory, copy everything over
if [ "$(realpath .)" != "$(realpath ${APP_DIR})" ]; then
    echo -e "${GREEN}Copying files to production directory...${NC}"
    mkdir -p ${APP_DIR}
    rsync -av --delete \
        --exclude '.git' \
        --exclude 'node_modules' \
        --exclude '.next' \
        . ${APP_DIR}/
fi

# Change to production directory for remaining operations
cd ${APP_DIR}

# Ensure version files are committed in production directory
git add src/utils/version.ts src/utils/changelog.ts
git commit -m "chore: Update version to ${NEW_VERSION}" || true

# Build production image locally
echo -e "${GREEN}Building production Docker image...${NC}"
docker buildx build \
  --platform linux/amd64 \
  --target runner \
  --build-arg NEXT_PUBLIC_API_URL=$PROD_URL \
  -t $APP_NAME:$NEW_VERSION \
  --load \
  ${APP_DIR}

# Stop and remove existing container, volumes, and images
echo -e "${GREEN}Performing complete cleanup...${NC}"

# Stop and remove all containers, volumes, and images
echo -e "${GREEN}Stopping and removing all containers and volumes...${NC}"
docker-compose down -v --rmi all || true

# Clean up all unused containers, networks, images without asking for confirmation
echo -e "${GREEN}Cleaning up unused Docker resources...${NC}"
docker system prune -af || true

# Deploy with docker-compose
echo -e "${GREEN}Deploying new version...${NC}"
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
