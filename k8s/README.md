# Kubernetes Guide For This Project

This document explains how Kubernetes is used in this repository, how traffic and data flow through the system, and how deployments are applied and updated.

## 1. High-level architecture

This project deploys three workloads into Kubernetes:

1. Frontend (Next.js)
2. Backend (Node.js + Express + Mongoose)
3. MongoDB (stateful data)

All resources are deployed in the `todo-app` namespace.

The runtime model is:

1. User requests enter through Ingress (`todo.local`)
2. `/` routes to frontend service
3. `/api` routes to backend service
4. Backend connects to MongoDB service
5. MongoDB persists data through PVC -> PV

## 2. Manifest entrypoint and resource composition

`kustomization.yaml` is the single apply entrypoint for this stack.

Apply everything with:

```bash
kubectl apply -k k8s/
```

The `kustomization.yaml` includes resources in this order:

1. Namespace
2. ConfigMap and Secret
3. Storage (PV + PVC)
4. Deployments (MongoDB, backend, frontend)
5. Services
6. Ingress

This keeps object dependencies logical. For example, deployments can reference ConfigMap/Secret and PVC because those resources are already created.

## 3. Folder structure and responsibility

- `namespace/`
  Creates namespace `todo-app`.

- `configmaps/`
  Stores non-sensitive backend configuration such as `PORT` and `CLIENT_ORIGIN`.

- `secrets/`
  Contains secret template (`mongodb-secret.example.yaml`) for MongoDB credentials and backend connection string.

- `volumes/`
  Defines persistent storage for MongoDB data.

- `deployments/`
  Defines desired pod state for frontend, backend, and MongoDB.

- `services/`
  Exposes each deployment internally (and frontend/backend via NodePort as configured).

- `ingress/`
  Defines host/path-based HTTP routing to frontend and backend.

## 4. Detailed runtime flow

### 4.1 Request flow

1. Browser calls `http://todo.local/`
2. Ingress path `/` forwards to `frontend-service:3000`
3. Browser or server-side frontend calls `http://todo.local/api/...`
4. Ingress path `/api` forwards to `backend-service:5000`
5. Backend processes request and reads/writes MongoDB via `mongodb-service:27017`

### 4.2 Frontend API proxy behavior

The frontend contains `app/api/[...path]/route.ts`, a catch-all proxy route.

Behavior:

1. Computes backend target from `BACKEND_INTERNAL_URL` or fallback host
2. Forwards method, headers, query params, and body
3. Returns backend response body and status to caller
4. Strips hop-by-hop headers (`content-length`, `transfer-encoding`, etc.)

In Kubernetes, frontend deployment explicitly sets:

`BACKEND_INTERNAL_URL=http://backend-service:5000`

So proxy calls remain inside the cluster network.

### 4.3 Backend and MongoDB interaction

Backend deployment loads environment from:

1. ConfigMap `backend-config`
2. Secret `mongodb-secret`

Important values:

1. `PORT=5000`
2. `CLIENT_ORIGIN=http://frontend-service:3000`
3. `MONGODB_URI=mongodb://<user>:<pass>@mongodb-service:27017/todo_app?authSource=admin`

Backend startup:

1. Reads env vars
2. Connects to MongoDB using Mongoose
3. Exposes API endpoints such as `/api/health` and `/api/todos`

MongoDB deployment gets root credentials from the same secret and mounts persistent data at `/data/db` using PVC `mongodb-pvc`.

## 5. Services and network exposure

### 5.1 Service types

1. `mongodb-service` is `ClusterIP`
	Only cluster-internal access is needed.

2. `backend-service` is `NodePort`
	Exposed on nodes and also used by Ingress.

3. `frontend-service` is `NodePort` with `nodePort: 30080`
	Exposed on nodes and used by Ingress for host/path routing.

### 5.2 Ingress rules

Host: `todo.local`

Paths:

1. `/api` -> `backend-service:5000`
2. `/` -> `frontend-service:3000`

Ingress is the main HTTP entrypoint for clean URL routing.

## 6. Storage model

MongoDB persistence uses:

1. PV `mongodb-pv`
	- Capacity: `2Gi`
	- Reclaim policy: `Retain`
	- Backing: `hostPath: /data/todo-mongo`

2. PVC `mongodb-pvc`
	- Requested storage: `1Gi`
	- Access mode: `ReadWriteOnce`

This ensures MongoDB data survives pod restarts. Since this uses `hostPath`, it is suitable for local/single-node setups and not ideal for multi-node production clusters.

## 7. Deployment and update lifecycle

### 7.1 Initial deployment

```bash
kubectl apply -k k8s/
```

### 7.2 Image rollout update

The Jenkins pipeline updates images with commit-based tags after pushing to Docker Hub:

```bash
kubectl set image deployment/backend backend=<repo>/todo-backend:<tag> -n todo-app
kubectl set image deployment/frontend frontend=<repo>/todo-frontend:<tag> -n todo-app
kubectl rollout status deployment/backend -n todo-app
kubectl rollout status deployment/frontend -n todo-app
```

This gives controlled rolling updates for frontend and backend.

## 8. CI/CD integration with Jenkins

The `Jenkinsfile` does the following Kubernetes-related steps:

1. Builds and pushes backend/frontend images to Docker Hub
2. Loads kubeconfig from Jenkins file credential
3. Ensures namespace exists (`todo-app`)
4. Applies full manifest set via Kustomize (`kubectl apply -k k8s/`)
5. Overrides backend/frontend deployment images to the current commit tag
6. Waits for rollout completion

This means manifests define stable structure, while CI injects release-specific image tags.

## 9. Operational checks

Use these commands to verify health after deploy.

```bash
kubectl get all -n todo-app
kubectl get ingress -n todo-app
kubectl get configmap backend-config -n todo-app -o yaml
kubectl get secret mongodb-secret -n todo-app -o yaml
kubectl logs deployment/backend -n todo-app --tail=100
kubectl logs deployment/frontend -n todo-app --tail=100
kubectl logs deployment/mongodb -n todo-app --tail=100
kubectl describe pod -n todo-app
```

## 10. Common failure points and fixes

1. Backend cannot connect to MongoDB
	- Check `mongodb-secret` values and URI format
	- Verify MongoDB pod is running and service name is `mongodb-service`

2. Ingress routes not working
	- Confirm ingress controller is installed in cluster
	- Ensure host `todo.local` resolves to your cluster ingress endpoint

3. Frontend cannot reach backend
	- Verify frontend env includes `BACKEND_INTERNAL_URL=http://backend-service:5000`
	- Check backend service and deployment are healthy

4. MongoDB data not persisting
	- Check PVC is bound
	- Confirm node has write permission to host path `/data/todo-mongo`

5. Rollout stuck in CI
	- Run `kubectl describe deployment/<name> -n todo-app`
	- Check image tag exists in registry and image pull succeeds

## 11. Security and production notes

1. `mongodb-secret.example.yaml` is a template only. Replace with real secret values.
2. Avoid `hostPath` for production; use proper dynamic storage class.
3. Consider `ClusterIP` for backend service when all external traffic goes through Ingress.
4. Add probes (`readinessProbe`, `livenessProbe`) to all deployments.
5. Add resource quotas, network policies, and pod security settings for harder isolation.

## 12. Quick start checklist

1. Create/replace real MongoDB secret manifest values.
2. Push frontend/backend images to registry.
3. Update deployment image repositories if needed.
4. Apply manifests with `kubectl apply -k k8s/`.
5. Confirm all pods/services/ingress are healthy.
6. Verify application through `todo.local`.
