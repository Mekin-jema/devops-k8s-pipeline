FROM jenkins/jenkins:lts-jdk17

USER root

ENV DEBIAN_FRONTEND=noninteractive

# ===============================
# Install base tools
# ===============================
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg \
    lsb-release \
    docker.io \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# ===============================
# Install Node.js 20
# ===============================
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && node -v && npm -v

# ===============================
# Install kubectl (pinned version recommended)
# ===============================
RUN curl -LO https://dl.k8s.io/release/v1.29.0/bin/linux/amd64/kubectl \
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl \
    && rm kubectl

# ===============================
# Docker permissions
# ===============================
RUN groupadd -f docker \
    && usermod -aG docker jenkins

# ===============================
# Jenkins plugins
# ===============================
USER jenkins

RUN jenkins-plugin-cli --plugins \
    docker-workflow \
    kubernetes-cli \
    pipeline-stage-view \
    git \
    workflow-aggregator \
    credentials-binding \
    timestamper \
    nodejs

# ===============================
# Cleanup plugin cache (important)
# ===============================
RUN rm -rf /var/jenkins_home/.cache || true

EXPOSE 8080 50000