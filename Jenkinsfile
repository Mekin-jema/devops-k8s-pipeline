pipeline {
  agent any

  parameters {
    string(name: 'DOCKERHUB_CREDENTIALS_ID', defaultValue: 'dockerhub-creds', description: 'Jenkins credentials ID for Docker Hub username/password')
    string(name: 'KUBECONFIG_CREDENTIALS_ID', defaultValue: 'kubeconfig', description: 'Jenkins credentials ID for kubeconfig secret file')
  }

  options {
    skipDefaultCheckout(true)
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    REGISTRY = 'docker.io'
    DOCKERHUB_NAMESPACE = 'mekin2024'
    BACKEND_IMAGE = "${REGISTRY}/${DOCKERHUB_NAMESPACE}/todo-backend"
    FRONTEND_IMAGE = "${REGISTRY}/${DOCKERHUB_NAMESPACE}/todo-frontend"
    IMAGE_TAG = 'local'
    K8S_NAMESPACE = 'todo-app'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.IMAGE_TAG = sh(returnStdout: true, script: 'git rev-parse --short=7 HEAD').trim()
          echo "Image tag resolved to ${env.IMAGE_TAG}"
        }
      }
    }

    stage('Agent Debug Info') {
      steps {
        script {
          echo "NODE_NAME=${env.NODE_NAME}"
          echo "NODE_LABELS=${env.NODE_LABELS}"
          echo "BRANCH_NAME=${env.BRANCH_NAME}"
          echo "GIT_BRANCH=${env.GIT_BRANCH}"
        }
        sh '''
          set +e
          echo "PATH=$PATH"
          for cmd in git node npm docker kubectl; do
            printf "%s -> " "$cmd"
            command -v "$cmd" || true
          done

          echo ""
          echo "Tool versions (if available):"
          git --version || true
          node --version || true
          npm --version || true
          docker --version || true
          kubectl version --client --short || kubectl version --client || true
        '''
      }
    }

    stage('Preflight') {
      steps {
        script {
          def missing = []
          ['git', 'node', 'npm', 'docker', 'kubectl'].each { tool ->
            if (sh(script: "command -v ${tool} >/dev/null 2>&1", returnStatus: true) != 0) {
              missing << tool
            }
          }

          if (!missing.isEmpty()) {
            error("""Missing required tools on Jenkins agent: ${missing.join(', ')}
Install these tools on the selected Jenkins node before running this pipeline.
""")
          }
        }
      }
    }

    stage('Install') {
      steps {
        sh '''
          set -euo pipefail

          if [ -f frontend/package-lock.json ]; then
            npm ci --prefix frontend
          else
            npm install --prefix frontend
          fi

          if [ -f backend/package-lock.json ]; then
            npm ci --prefix backend
          else
            npm install --prefix backend
          fi
        '''
      }
    }

    stage('Validate') {
      parallel {
        stage('Frontend lint') {
          steps {
            sh 'npm run lint --prefix frontend'
          }
        }
        stage('Backend build') {
          steps {
            sh 'npm run build --prefix backend'
          }
        }
        stage('Frontend build') {
          steps {
            sh 'npm run build --prefix frontend'
          }
        }
      }
    }

    stage('Build Images') {
      steps {
        sh '''
          set -euo pipefail
          docker build -f docker/backend.Dockerfile -t ${BACKEND_IMAGE}:${IMAGE_TAG} .
          docker build -f docker/frontend.Dockerfile -t ${FRONTEND_IMAGE}:${IMAGE_TAG} .
        '''
      }
    }

    stage('Push Images') {
      steps {
        withCredentials([
          usernamePassword(credentialsId: params.DOCKERHUB_CREDENTIALS_ID, usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_TOKEN')
        ]) {
          sh '''
            set -euo pipefail
            echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USER" --password-stdin
            docker push ${BACKEND_IMAGE}:${IMAGE_TAG}
            docker push ${FRONTEND_IMAGE}:${IMAGE_TAG}
            docker logout
          '''
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        script {
          try {
            withCredentials([
              file(credentialsId: params.KUBECONFIG_CREDENTIALS_ID, variable: 'KUBECONFIG_FILE')
            ]) {
              sh '''
                set -euo pipefail
                export KUBECONFIG="$KUBECONFIG_FILE"
                kubectl apply -k k8s/
                kubectl set image deployment/backend backend=${BACKEND_IMAGE}:${IMAGE_TAG} -n ${K8S_NAMESPACE}
                kubectl set image deployment/frontend frontend=${FRONTEND_IMAGE}:${IMAGE_TAG} -n ${K8S_NAMESPACE}
                kubectl rollout status deployment/backend -n ${K8S_NAMESPACE}
                kubectl rollout status deployment/frontend -n ${K8S_NAMESPACE}
              '''
            }
          } catch (hudson.AbortException e) {
            if (e.message?.contains("Could not find credentials entry with ID '${params.KUBECONFIG_CREDENTIALS_ID}'")) {
              echo "Skipping deploy: missing Jenkins credential '${params.KUBECONFIG_CREDENTIALS_ID}'."
              currentBuild.result = 'UNSTABLE'
            } else {
              throw e
            }
          }
        }
      }
    }
  }

  post {
    always {
      script {
        deleteDir()
      }
    }
  }
}
