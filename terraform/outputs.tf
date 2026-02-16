################################################################################
# Extrapl SaaS Platform - Root Outputs
################################################################################

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.alb_dns_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "s3_bucket_name" {
  description = "Name of the S3 document storage bucket"
  value       = module.s3.bucket_name
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = module.ecr.repository_url
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "domain_name" {
  description = "Primary domain name"
  value       = var.domain_name
}

output "nameservers" {
  description = "Route 53 nameservers for DNS delegation"
  value       = module.dns.nameservers
}
