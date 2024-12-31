#!/bin/bash
# this script is for non-initial deployment only
git pull --ff
docker compose build
docker compose down
docker compose up -d
