#!/bin/bash

# Check if .env.local exists
if [ -f "../.env.local" ]; then
    echo ".env.local already exists. Please modify it manually or delete it to create a new one."
    exit 1
fi

# Copy .env.example to .env.local
cp ../.env.example ../.env.local

echo "Created .env.local from .env.example"
echo "Please update the following environment variables in .env.local:"
echo "1. NEXT_PUBLIC_UNSPLASH_ACCESS_KEY (Get from https://unsplash.com/developers)"
echo "2. Any other environment variables needed for your setup"
