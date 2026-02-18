################################################################################
# Extrapl SaaS Platform - Root Variables
################################################################################

variable "project_name" {
  description = "Name of the project, used as a prefix for all resources"
  type        = string
  default     = "extrapl"
}

variable "environment" {
  description = "Deployment environment (staging or prod)"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "Environment must be either 'staging' or 'prod'."
  }
}

variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "eu-west-1"
}

variable "domain_name" {
  description = "Primary domain name for the platform"
  type        = string
  default     = "extrapl.it"
}

variable "alert_email" {
  description = "Email address for security and operational alerts"
  type        = string
  default     = ""
}

################################################################################
# Networking
################################################################################

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones to use"
  type        = list(string)
  default     = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
}

################################################################################
# ECS Configuration
################################################################################

variable "ecs_app_cpu" {
  description = "CPU units for the ECS task (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "ecs_app_memory" {
  description = "Memory (MiB) for the ECS task"
  type        = number
  default     = 1024
}

variable "ecs_app_count_min" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 2
}

variable "ecs_app_count_max" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 10
}

################################################################################
# RDS Configuration
################################################################################

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "rds_allocated_storage" {
  description = "Allocated storage for RDS in GB"
  type        = number
  default     = 50
}
