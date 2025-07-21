#!/bin/bash

# Extractly Kubernetes Deployment Script
set -e

echo "🚀 Starting Extractly Kubernetes Deployment"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Configuration
DOCKER_IMAGE="extractly:latest"
NAMESPACE="extractly"

# Build Docker image
echo "🔧 Building Docker image..."
docker build -t $DOCKER_IMAGE .

# Create namespace and apply base configurations
echo "🌐 Creating Kubernetes namespace..."
kubectl apply -f k8s-namespace.yaml

# Create secrets (user needs to update these)
echo "🔐 Creating secrets (update with your actual values)..."
echo "⚠️  Please update the secrets in k8s-secrets.yaml with your actual encoded values"

# Create secrets file
cat > k8s-secrets.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: extractly-secrets
  namespace: extractly
type: Opaque
data:
  # Base64 encode your values: echo -n "your_value" | base64
  database-url: $(echo -n "postgresql://user:pass@postgres-service:5432/extractly" | base64 -w 0)
  postgres-user: $(echo -n "extractly" | base64 -w 0)
  postgres-password: $(echo -n "changeme123" | base64 -w 0)
  gemini-api-key: $(echo -n "your_gemini_api_key_here" | base64 -w 0)
EOF

# Apply database first
echo "🗄️  Deploying PostgreSQL database..."
kubectl apply -f k8s-secrets.yaml
kubectl apply -f k8s-database.yaml

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/postgres -n extractly

# Deploy main application
echo "🚀 Deploying Extractly application..."
kubectl apply -f kubernetes-deployment.yaml

# Wait for application to be ready
echo "⏳ Waiting for application to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/extractly-app -n extractly

# Apply ingress (optional)
echo "🌍 Applying ingress configuration..."
kubectl apply -f k8s-ingress.yaml

# Show deployment status
echo "✅ Deployment complete! Checking status..."
kubectl get all -n extractly

echo ""
echo "🎉 Extractly has been deployed to Kubernetes!"
echo ""
echo "📊 To check logs:"
echo "   kubectl logs -f deployment/extractly-app -n extractly"
echo ""
echo "🔧 To scale the application:"
echo "   kubectl scale deployment extractly-app --replicas=5 -n extractly"
echo ""
echo "🌐 To access the application:"
echo "   kubectl port-forward service/extractly-service 8080:80 -n extractly"
echo "   Then visit: http://localhost:8080"
echo ""
echo "📈 To monitor HPA:"
echo "   kubectl get hpa -n extractly"
echo ""