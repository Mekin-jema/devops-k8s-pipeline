FROM jenkins/jenkins:lts-jdk17

USER root

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg \
    lsb-release \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl \
    && rm kubectl

RUN usermod -aG docker jenkins

USER jenkins

RUN jenkins-plugin-cli --plugins \
    docker-workflow \
    kubernetes-cli \
    pipeline-stage-view \
    git \
    workflow-aggregator \
    credentials-binding \
    timestamper

EXPOSE 8080 50000
