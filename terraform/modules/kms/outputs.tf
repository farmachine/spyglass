################################################################################
# KMS Module - Outputs
################################################################################

output "rds_key_arn" {
  description = "ARN of the KMS key for RDS encryption"
  value       = aws_kms_key.rds.arn
}

output "rds_key_id" {
  description = "ID of the KMS key for RDS encryption"
  value       = aws_kms_key.rds.key_id
}

output "s3_key_arn" {
  description = "ARN of the KMS key for S3 encryption"
  value       = aws_kms_key.s3.arn
}

output "s3_key_id" {
  description = "ID of the KMS key for S3 encryption"
  value       = aws_kms_key.s3.key_id
}

output "secrets_key_arn" {
  description = "ARN of the general KMS key (used for Secrets Manager)"
  value       = aws_kms_key.general.arn
}

output "cloudwatch_key_arn" {
  description = "ARN of the general KMS key (used for CloudWatch Logs)"
  value       = aws_kms_key.general.arn
}

output "ecr_key_arn" {
  description = "ARN of the general KMS key (used for ECR)"
  value       = aws_kms_key.general.arn
}

output "general_key_arn" {
  description = "ARN of the general purpose KMS key"
  value       = aws_kms_key.general.arn
}

output "general_key_id" {
  description = "ID of the general purpose KMS key"
  value       = aws_kms_key.general.key_id
}
