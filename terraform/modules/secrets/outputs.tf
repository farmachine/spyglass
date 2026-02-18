################################################################################
# Secrets Module - Outputs
################################################################################

output "secret_arns" {
  description = "List of all secret ARNs in order: db-credentials, jwt-secret, session-secret, credential-encryption-key, encryption-salt, gemini-api-key"
  value = [
    aws_secretsmanager_secret.main["db-credentials"].arn,
    aws_secretsmanager_secret.main["jwt-secret"].arn,
    aws_secretsmanager_secret.main["session-secret"].arn,
    aws_secretsmanager_secret.main["credential-encryption-key"].arn,
    aws_secretsmanager_secret.main["encryption-salt"].arn,
    aws_secretsmanager_secret.main["gemini-api-key"].arn,
  ]
}

output "secret_arns_map" {
  description = "Map of secret name to ARN for all secrets"
  value       = { for k, v in aws_secretsmanager_secret.main : k => v.arn }
}

output "db_credentials_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.main["db-credentials"].arn
}

output "jwt_secret_arn" {
  description = "ARN of the JWT secret"
  value       = aws_secretsmanager_secret.main["jwt-secret"].arn
}

output "session_secret_arn" {
  description = "ARN of the session secret"
  value       = aws_secretsmanager_secret.main["session-secret"].arn
}

output "credential_encryption_key_arn" {
  description = "ARN of the credential encryption key secret"
  value       = aws_secretsmanager_secret.main["credential-encryption-key"].arn
}

output "encryption_salt_arn" {
  description = "ARN of the encryption salt secret"
  value       = aws_secretsmanager_secret.main["encryption-salt"].arn
}

output "gemini_api_key_arn" {
  description = "ARN of the Gemini API key secret"
  value       = aws_secretsmanager_secret.main["gemini-api-key"].arn
}
