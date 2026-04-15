# Docker Files

This folder contains Dockerfiles for both services.

## Build commands (from repository root)

- Frontend image:
  - `docker build -f docker/frontend.Dockerfile -t mekin2024/todo-frontend:latest .`

- Backend image:
  - `docker build -f docker/backend.Dockerfile -t mekin2024/todo-backend:latest .`

## Run locally (optional)

- Frontend: `docker run -p 3000:3000 mekin2024/todo-frontend:latest`
- Backend: `docker run -p 5000:5000 --env-file backend/.env mekin2024/todo-backend:latest`
