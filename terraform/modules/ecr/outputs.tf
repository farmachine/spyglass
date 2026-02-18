################################################################################
# ECR Module - Outputs
################################################################################

output "app_repository_url" {
  description = "URL of the application ECR repository"
  value       = aws_ecr_repository.app.repository_url
}

output "sidecar_repository_url" {
  description = "URL of the sidecar ECR repository"
  value       = aws_ecr_repository.sidecar.repository_url
}

output "app_repository_arn" {
  description = "ARN of the application ECR repository"
  value       = aws_ecr_repository.app.arn
}

# Alias used by root module
output "repository_url" {
  description = "URL of the application ECR repository (alias)"
  value       = aws_ecr_repository.app.repository_url
}
