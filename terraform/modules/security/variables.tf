################################################################################
# Security Module - Variables
################################################################################

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Deployment environment (staging or prod)"
  type        = string
}

variable "cloudwatch_kms_key_arn" {
  description = "ARN of the KMS key for CloudWatch Logs and SNS encryption"
  type        = string
}

variable "alert_email" {
  description = "Email address for security alert notifications"
  type        = string
  default     = ""
}

variable "enable_guardduty" {
  description = "Enable GuardDuty (requires service subscription to be active)"
  type        = bool
  default     = true
}

variable "enable_securityhub" {
  description = "Enable Security Hub (requires service subscription to be active)"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
