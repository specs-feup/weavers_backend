#!/bin/sh

# Variables
IMAGE_NAME=weavers_backend_image
CONTAINER_NAME=weavers_backend_container

# Build image
 docker build -t "$IMAGE_NAME" .

# Run container and execute command
docker run --name "$CONTAINER_NAME" --rm -p 4000:4000 "$IMAGE_NAME" bash -c "npm start"