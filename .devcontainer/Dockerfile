FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# Install pnpm 9 explicitly and ensure corepack is enabled
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

# Install zsh for developer shell preference
RUN apt-get update && apt-get install -y zsh && rm -rf /var/lib/apt/lists/*

# Install Playwright system dependencies ahead of time
RUN npx --yes playwright@1.47.0 install-deps

# Use zsh as default shell for the node user
RUN chsh -s /usr/bin/zsh node
