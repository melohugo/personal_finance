# Stage 1: Build dependencies and generate Prisma Client
FROM node:22-alpine AS builder

WORKDIR /app

# Install native dependencies for Prisma and Node
RUN apk add --no-cache openssl libc6-compat ca-certificates curl

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code and config
COPY . .

# Generate Prisma Client and build the application
RUN npx prisma generate
RUN npm run build

# Stage 2: Final runtime image
FROM node:22-alpine AS runner

WORKDIR /app

# Install minimal runtime dependencies
RUN apk add --no-cache openssl libc6-compat ca-certificates curl && update-ca-certificates

# Copy only production dependencies and build artifacts from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules ./node_modules

# Ensure production environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

# Healthcheck to verify the service is up (Assumes a /health route exists or basic port check)
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/ || exit 1

# Start the application, running Prisma migrations before launching the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
