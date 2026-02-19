################################################################################
# Extrapl SaaS Platform - Root Module
################################################################################

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Repository  = "extrapl"
  }
}

################################################################################
# KMS Keys (must be created first as other modules depend on them)
################################################################################

module "kms" {
  source = "./modules/kms"

  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

################################################################################
# Networking
################################################################################

module "vpc" {
  source = "./modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  single_nat_gateway = var.environment == "staging" ? true : false
  tags               = local.common_tags
}

################################################################################
# DNS & TLS Certificates
################################################################################

module "dns" {
  source = "./modules/dns"

  domain_name  = var.domain_name
  alb_dns_name = module.alb.alb_dns_name
  alb_zone_id  = module.alb.alb_zone_id
  tags         = local.common_tags
}

################################################################################
# ECR Repository
################################################################################

module "ecr" {
  source = "./modules/ecr"

  project_name   = var.project_name
  environment    = var.environment
  kms_key_arn    = module.kms.ecr_key_arn
  tags           = local.common_tags
}

################################################################################
# Secrets Manager
################################################################################

module "secrets" {
  source = "./modules/secrets"

  project_name = var.project_name
  environment  = var.environment
  kms_key_arn  = module.kms.secrets_key_arn
  tags         = local.common_tags
}

################################################################################
# S3 Document Storage
################################################################################

module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
  environment  = var.environment
  kms_key_arn  = module.kms.s3_key_arn
  tags         = local.common_tags
}

################################################################################
# Application Load Balancer
################################################################################

module "alb" {
  source = "./modules/alb"

  project_name        = var.project_name
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnet_ids
  certificate_arn     = module.dns.certificate_arn
  access_log_bucket   = module.s3.access_log_bucket_id
  tags                = local.common_tags
}

################################################################################
# ECS Fargate Cluster & Service
################################################################################

module "ecs" {
  source = "./modules/ecs"

  project_name         = var.project_name
  environment          = var.environment
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  alb_security_group_id = module.alb.security_group_id
  target_group_arn     = module.alb.target_group_arn
  ecr_repository_url   = module.ecr.repository_url
  cloudwatch_kms_key_arn = module.kms.cloudwatch_key_arn

  secrets_arns = module.secrets.secret_arns
  kms_key_arn  = module.kms.secrets_key_arn

  app_cpu    = var.ecs_app_cpu
  app_memory = var.ecs_app_memory
  app_count_min = var.ecs_app_count_min
  app_count_max = var.ecs_app_count_max

  db_driver      = "neon"
  s3_bucket_name = module.s3.bucket_name
  base_domain    = var.domain_name

  tags = local.common_tags
}

################################################################################
# RDS PostgreSQL
################################################################################

module "rds" {
  source = "./modules/rds"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  isolated_subnet_ids = module.vpc.isolated_subnet_ids
  ecs_security_group_id = module.ecs.security_group_id
  kms_key_arn        = module.kms.rds_key_arn

  instance_class     = var.rds_instance_class
  allocated_storage  = var.rds_allocated_storage
  multi_az           = var.environment == "prod" ? true : false

  db_credentials_secret_arn = module.secrets.db_credentials_secret_arn

  tags = local.common_tags
}

################################################################################
# WAF
################################################################################

module "waf" {
  source = "./modules/waf"

  project_name = var.project_name
  environment  = var.environment
  alb_arn      = module.alb.alb_arn
  tags         = local.common_tags
}

################################################################################
# SES Email Sending
################################################################################

module "ses" {
  source = "./modules/ses"

  environment = var.environment
  domain      = "extrapl.it"
  tags        = local.common_tags
}

################################################################################
# Security Services
################################################################################

module "security" {
  source = "./modules/security"

  project_name          = var.project_name
  environment           = var.environment
  cloudwatch_kms_key_arn = module.kms.cloudwatch_key_arn
  alert_email           = var.alert_email
  enable_guardduty      = false  # Enable after AWS account subscription activates
  enable_securityhub    = false  # Enable after AWS account subscription activates
  tags                  = local.common_tags
}
