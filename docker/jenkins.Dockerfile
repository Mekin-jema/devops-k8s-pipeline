FROM jenkins/jenkins:lts-jdk17

USER root

ENV DEBIAN_FRONTEND=noninteractive

# ===============================
# Install system dependencies
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
# Install Node.js + npm (FIX for your pipeline)
# ===============================
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && node -v \
    && npm -v

# ===============================
# Install kubectl
# ===============================
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl \
    && rm kubectl

# ===============================
# Allow Jenkins user to use Docker
# ===============================
RUN usermod -aG docker jenkins

# ===============================
# Install Jenkins plugins
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
# Ports
# ===============================
EXPOSE 8080 50000