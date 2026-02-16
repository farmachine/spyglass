################################################################################
# Extrapl SaaS Platform - Backend Configuration
################################################################################

terraform {
  backend "s3" {
    bucket         = "extrapl-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "extrapl-terraform-locks"

    # Uncomment and configure for production use:
    # kms_key_id   = "alias/terraform-state"
    # role_arn     = "arn:aws:iam::role/TerraformStateAccess"
  }
}
