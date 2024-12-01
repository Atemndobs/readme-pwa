#!/bin/bash

# Exit on error
set -e

# Set variables
IMAGE_NAME="readme-pwa"
PLATFORM="linux/amd64"

# Enable Docker BuildKit
export DOCKER_BUILDKIT=1

# Build local image
echo "Building local image..."
docker buildx build \
  --platform $PLATFORM \
  --tag $IMAGE_NAME:latest \
  --build-arg NEXT_PUBLIC_API_URL=https://tts.cloud.atemkeng.de \
  --load \
  .

echo "Local build completed!"
