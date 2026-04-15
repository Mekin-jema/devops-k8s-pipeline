# Kubernetes Manifests Structure

This folder is organized by resource type for easier maintenance.

## Folder layout

- `namespace/` → Namespace manifests
- `deployments/` → App and DB deployments
- `services/` → Service exposure (ClusterIP / NodePort)
- `volumes/` → PV and PVC resources
- `configmaps/` → Non-secret app configuration
- `secrets/` → Secret templates (`*.example.yaml`)
- `ingress/` → Ingress routing
- `kustomization.yaml` → Single entrypoint to apply all resources

## Apply manifests

- `kubectl apply -k k8s/`

## Notes

- Replace image names in deployment files with your pushed images.
- Copy `secrets/mongodb-secret.example.yaml` to a real secret manifest and fill actual values before production use.
