variable "project" {
  description = "Project name"
  type        = string
  default     = "extrapl"
}

variable "environment" {
  description = "Environment (staging, production)"
  type        = string
}

variable "domain" {
  description = "Domain to verify for SES email sending (e.g., extrapl.it)"
  type        = string
}

variable "documents_bucket_name" {
  description = "Name of the S3 bucket for storing inbound emails"
  type        = string
  default     = ""
}

variable "documents_bucket_arn" {
  description = "ARN of the S3 bucket for storing inbound emails"
  type        = string
  default     = ""
}

variable "webhook_secret" {
  description = "Shared secret for authenticating webhook calls from Lambda to the app"
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}
