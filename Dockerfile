# ==============================================================================
# Stage 1: Build Node.js application
# ==============================================================================
FROM node:20-slim AS node-builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build frontend (Vite) and backend (esbuild)
RUN npm run build

# ==============================================================================
# Stage 2: Install Python dependencies
# ==============================================================================
FROM python:3.14-slim AS python-builder

WORKDIR /app

# Install Python dependencies
COPY services/ ./services/
COPY prompts/ ./prompts/
COPY utils/ ./utils/

# Install common Python packages used by the extraction services
RUN pip install --no-cache-dir --target=/app/python-deps \
    google-generativeai \
    python-dotenv \
    openpyxl \
    psycopg2-binary \
    requests

# ==============================================================================
# Stage 3: Production runtime
# ==============================================================================
FROM node:20-slim AS production

# Install runtime dependencies (Python, poppler for PDF processing, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    poppler-utils \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built Node.js artifacts
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/package.json ./package.json

# Copy Python services and dependencies
COPY --from=python-builder /app/services ./services
COPY --from=python-builder /app/prompts ./prompts
COPY --from=python-builder /app/utils ./utils
COPY --from=python-builder /app/python-deps /usr/local/lib/python3.11/dist-packages

# Copy config file
COPY config.json* ./

# Copy Drizzle migration files
COPY drizzle.config.ts ./
COPY shared ./shared
COPY migrations* ./migrations/

# Create non-root user for security
RUN groupadd -r extrapl && useradd -r -g extrapl -s /bin/false extrapl \
    && chown -R extrapl:extrapl /app

USER extrapl

# Expose application port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
