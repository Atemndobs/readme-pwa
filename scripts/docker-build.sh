#!/bin/bash

# Exit on error
set -e

# Login to Docker Hub
echo "Logging in to Docker Hub..."
docker login

# Set variables
IMAGE_NAME="atemnbobs/readme-pwa"
PLATFORMS="linux/amd64,linux/arm64"

# Enable Docker BuildKit
export DOCKER_BUILDKIT=1

# Create and use builder
echo "Setting up multi-platform builder..."
docker buildx create --use

# Build and push multi-platform images
echo "Building and pushing multi-platform images..."
docker buildx build \
  --platform $PLATFORMS \
  --tag $IMAGE_NAME:latest \
  --build-arg NEXT_PUBLIC_API_URL=https://your-production-url.com \
  --push \
  .

echo "Multi-platform build completed and pushed to Docker Hub!"
