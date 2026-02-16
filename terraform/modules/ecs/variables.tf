################################################################################
# ECS Module - Variables
################################################################################

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Deployment environment (staging or prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs of the private subnets for ECS tasks"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID of the ALB to allow inbound traffic from"
  type        = string
}

variable "target_group_arn" {
  description = "ARN of the ALB target group to register tasks with"
  type        = string
}

variable "ecr_repository_url" {
  description = "URL of the ECR repository for the application image"
  type        = string
}

variable "cloudwatch_kms_key_arn" {
  description = "ARN of the KMS key for CloudWatch Logs encryption"
  type        = string
}

variable "secrets_arns" {
  description = "List of Secrets Manager ARNs to inject into the container"
  type        = list(string)
}

variable "kms_key_arn" {
  description = "ARN of the KMS key for decrypting secrets"
  type        = string
}

variable "app_cpu" {
  description = "CPU units for the ECS task (1024 = 1 vCPU)"
  type        = number
  default     = 512

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.app_cpu)
    error_message = "CPU must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "app_memory" {
  description = "Memory (MiB) for the ECS task"
  type        = number
  default     = 1024
}

variable "app_count_min" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 2
}

variable "app_count_max" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 10
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
