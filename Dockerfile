# Multi-stage build for Extractly AI application
FROM node:18-alpine as frontend-builder

# Set working directory for frontend build
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Python runtime stage
FROM python:3.11-slim as python-stage

# Install system dependencies for PDF processing
RUN apt-get update && apt-get install -y \
    poppler-utils \
    imagemagick \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen

# Final production stage
FROM node:18-alpine

# Install Python and system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    poppler-utils \
    imagemagick \
    curl

# Set working directory
WORKDIR /app

# Copy Node.js dependencies from builder stage
COPY --from=frontend-builder /app/node_modules ./node_modules
COPY --from=frontend-builder /app/dist ./dist

# Copy Python dependencies
COPY --from=python-stage /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-stage /usr/local/bin /usr/local/bin

# Copy application files
COPY . .
COPY --from=frontend-builder /app/dist/public ./dist/public

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S extractly -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R extractly:nodejs /app
USER extractly

# Expose application port
EXPOSE 5000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["npm", "start"]