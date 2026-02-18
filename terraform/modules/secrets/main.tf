################################################################################
# Secrets Module - Extrapl SaaS Platform
################################################################################

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  # Define all application secrets with their initial placeholder values
  secrets = {
    db-credentials = {
      name        = "${var.environment}/extrapl/db-credentials"
      description = "Database credentials for PostgreSQL"
      initial_value = jsonencode({
        username = "extrapl_admin"
        password = "CHANGE_ME_BEFORE_DEPLOY"
        host     = "pending"
        port     = 5432
        dbname   = "extrapl"
      })
    }
    jwt-secret = {
      name          = "${var.environment}/extrapl/jwt-secret"
      description   = "JWT signing secret for authentication tokens"
      initial_value = jsonencode({ secret = "CHANGE_ME_BEFORE_DEPLOY" })
    }
    session-secret = {
      name          = "${var.environment}/extrapl/session-secret"
      description   = "Session encryption secret"
      initial_value = jsonencode({ secret = "CHANGE_ME_BEFORE_DEPLOY" })
    }
    credential-encryption-key = {
      name          = "${var.environment}/extrapl/credential-encryption-key"
      description   = "Encryption key for credential storage"
      initial_value = jsonencode({ key = "CHANGE_ME_BEFORE_DEPLOY" })
    }
    encryption-salt = {
      name          = "${var.environment}/extrapl/encryption-salt"
      description   = "Salt value for encryption operations"
      initial_value = jsonencode({ salt = "CHANGE_ME_BEFORE_DEPLOY" })
    }
    gemini-api-key = {
      name          = "${var.environment}/extrapl/gemini-api-key"
      description   = "Google Gemini API key for AI services"
      initial_value = jsonencode({ api_key = "CHANGE_ME_BEFORE_DEPLOY" })
    }
  }
}

################################################################################
# Secrets Manager Secrets
################################################################################

resource "aws_secretsmanager_secret" "main" {
  for_each = local.secrets

  name        = each.value.name
  description = each.value.description
  kms_key_id  = var.kms_key_arn

  recovery_window_in_days = var.environment == "prod" ? 30 : 7

  tags = merge(var.tags, {
    Name   = each.value.name
    Secret = each.key
  })
}

resource "aws_secretsmanager_secret_version" "main" {
  for_each = local.secrets

  secret_id     = aws_secretsmanager_secret.main[each.key].id
  secret_string = each.value.initial_value

  lifecycle {
    ignore_changes = [secret_string]
  }
}

################################################################################
# Secret Rotation Configuration (placeholder - rotation lambda required)
################################################################################

# Note: Secret rotation requires a Lambda function to be deployed separately.
# Uncomment and configure once the rotation Lambda is available.
#
# resource "aws_secretsmanager_secret_rotation" "db_credentials" {
#   secret_id           = aws_secretsmanager_secret.main["db-credentials"].id
#   rotation_lambda_arn = var.rotation_lambda_arn
#
#   rotation_rules {
#     automatically_after_days = 30
#   }
# }
