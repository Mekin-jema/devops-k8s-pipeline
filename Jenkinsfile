pipeline {
  agent any

  parameters {
    booleanParam(name: 'FORCE_RELEASE_STAGES', defaultValue: false, description: 'Run Build/Push/Deploy stages even if release tools are missing in preflight checks')
    string(name: 'NODEJS_TOOL_NAME', defaultValue: '', description: 'Optional Jenkins NodeJS tool name (Manage Jenkins > Tools). Leave empty to use node/npm preinstalled on agent.')
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
    RELEASE_READY = 'false'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.IMAGE_TAG = sh(returnStdout: true, script: 'git rev-parse --short=7 HEAD').trim()

          def branchCandidate = (env.BRANCH_NAME ?: env.GIT_BRANCH ?: env.CHANGE_BRANCH ?: '').trim()
          if (!branchCandidate || branchCandidate == 'HEAD') {
            branchCandidate = sh(
              returnStdout: true,
              script: "git for-each-ref --format='%(refname:short)' --points-at HEAD refs/remotes/origin | head -n1"
            ).trim()
          }
          if (!branchCandidate || branchCandidate == 'HEAD') {
            branchCandidate = sh(returnStdout: true, script: 'git rev-parse --abbrev-ref HEAD').trim()
          }

          env.EFFECTIVE_BRANCH = branchCandidate
          def normalizedBranch = branchCandidate
            .replaceFirst('^refs/heads/', '')
            .replaceFirst('^refs/remotes/', '')
            .replaceFirst('^origin/', '')

          env.RELEASE_BRANCH = (normalizedBranch in ['main', 'master']).toString()
          echo "Resolved branch='${env.EFFECTIVE_BRANCH}', normalized='${normalizedBranch}', releaseBranch=${env.RELEASE_BRANCH}"
        }
      }
    }

    stage('Configure Tools') {
      steps {
        script {
          if (params.NODEJS_TOOL_NAME?.trim()) {
            def nodeHome = tool name: params.NODEJS_TOOL_NAME, type: 'jenkins.plugins.nodejs.tools.NodeJSInstallation'
            env.PATH = "${nodeHome}/bin:${env.PATH}"
            echo "Using Jenkins NodeJS tool '${params.NODEJS_TOOL_NAME}' from ${nodeHome}"
          } else {
            echo 'NODEJS_TOOL_NAME is empty. Using node/npm from the agent PATH.'
          }
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
          echo "EFFECTIVE_BRANCH=${env.EFFECTIVE_BRANCH}"
          echo "RELEASE_BRANCH=${env.RELEASE_BRANCH}"
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
          ['git', 'node', 'npm'].each { tool ->
            if (sh(script: "command -v ${tool} >/dev/null 2>&1", returnStatus: true) != 0) {
              missing << tool
            }
          }

          if (!missing.isEmpty()) {
            error("""Missing required tools on Jenkins agent: ${missing.join(', ')}
Install these tools on the selected Jenkins node before running this pipeline.

Fix options:
1) Use the custom Jenkins image from docker/jenkins.Dockerfile (includes git/node/npm/docker/kubectl).
2) Configure Jenkins NodeJS tool (Manage Jenkins > Tools) and set NODEJS_TOOL_NAME parameter.
""")
          }

          env.RELEASE_READY = 'true'
          if (env.RELEASE_BRANCH == 'true') {
            def missingReleaseTools = []
            ['docker', 'kubectl'].each { tool ->
              if (sh(script: "command -v ${tool} >/dev/null 2>&1", returnStatus: true) != 0) {
                missingReleaseTools << tool
              }
            }

            if (!missingReleaseTools.isEmpty()) {
              if (params.FORCE_RELEASE_STAGES) {
                echo "FORCE_RELEASE_STAGES=true: continuing even though release tools are missing: ${missingReleaseTools.join(', ')}"
              } else {
                env.RELEASE_READY = 'false'
                echo "Release stages will be skipped because required release tools are missing: ${missingReleaseTools.join(', ')}"
              }
            }
          }

          echo "Release gating: releaseBranch=${env.RELEASE_BRANCH}, releaseReady=${env.RELEASE_READY}, forceReleaseStages=${params.FORCE_RELEASE_STAGES}"
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
      when {
        expression { env.RELEASE_BRANCH == 'true' && (env.RELEASE_READY == 'true' || params.FORCE_RELEASE_STAGES) }
      }
      steps {
        sh '''
          set -euo pipefail
          docker build -f docker/backend.Dockerfile -t ${BACKEND_IMAGE}:${IMAGE_TAG} .
          docker build -f docker/frontend.Dockerfile -t ${FRONTEND_IMAGE}:${IMAGE_TAG} .
        '''
      }
    }

    stage('Push Images') {
      when {
        expression { env.RELEASE_BRANCH == 'true' && (env.RELEASE_READY == 'true' || params.FORCE_RELEASE_STAGES) }
      }
      steps {
        withCredentials([
          usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_TOKEN')
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
      when {
        expression { env.RELEASE_BRANCH == 'true' && (env.RELEASE_READY == 'true' || params.FORCE_RELEASE_STAGES) }
      }
      steps {
        withCredentials([
          file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG_FILE')
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
      }
    }
  }

  post {
    always {
      script {
        if (env.WORKSPACE?.trim()) {
          try {
            cleanWs(notFailBuild: true)
          } catch (NoSuchMethodError e) {
            echo "cleanWs step is unavailable (${e.class.simpleName}); falling back to deleteDir()."
            deleteDir()
          } catch (MissingMethodException e) {
            echo "cleanWs step is unavailable (${e.class.simpleName}); falling back to deleteDir()."
            deleteDir()
          }
        } else {
          echo 'Skipping workspace cleanup because no workspace was allocated.'
        }
      }
    }
  }
}
