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
  description = "Domain to verify for SES email sending (e.g., extrapl.io)"
  type        = string
}

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}
