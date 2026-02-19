################################################################################
# AWS SES — Email Sending for extrapl
################################################################################
# Verifies the domain identity and creates DKIM records for email authentication.
# DNS records must be added to the domain's DNS provider (Cloudflare for extrapl.io).
################################################################################

locals {
  name_prefix = "${var.project}-${var.environment}"
}

# Domain identity for sending emails
resource "aws_ses_domain_identity" "main" {
  domain = var.domain
}

# DKIM authentication for the domain
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# MAIL FROM domain (optional, improves deliverability)
resource "aws_ses_domain_mail_from" "main" {
  domain           = aws_ses_domain_identity.main.domain
  mail_from_domain = "mail.${var.domain}"
}

# Configuration set for tracking email delivery metrics
resource "aws_ses_configuration_set" "main" {
  name = "${local.name_prefix}-email"

  delivery_options {
    tls_policy = "Require"
  }

  reputation_metrics_enabled = true
  sending_enabled            = true
}
