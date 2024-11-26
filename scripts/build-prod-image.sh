#!/bin/bash

# Exit on error
set -e

# Set variables
IMAGE_NAME="atemnbobs/readme-pwa"
PLATFORM="linux/amd64"
VERSION="v0.0.1"
PROD_URL="https://tts.cloud.atemkeng.de"

# Build production image for amd64
echo "Building production image for $PLATFORM..."
docker buildx build \
  --platform $PLATFORM \
  --target runner \
  --build-arg NEXT_PUBLIC_API_URL=$PROD_URL \
  -t $IMAGE_NAME:latest \
  -t $IMAGE_NAME:$VERSION \
  --push \
  .

echo "✅ Production image built and pushed successfully!"
echo "Tags: $IMAGE_NAME:latest, $IMAGE_NAME:$VERSION"
