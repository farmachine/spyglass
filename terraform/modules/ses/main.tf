################################################################################
# AWS SES — Email Sending & Receiving for extrapl
################################################################################
# Verifies the domain identity and creates DKIM records for email authentication.
# Also configures inbound email receiving via SES Receipt Rules → S3 → SNS → Lambda.
################################################################################

locals {
  name_prefix = "${var.project}-${var.environment}"
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

################################################################################
# Outbound Email — Domain Identity & DKIM
################################################################################

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

################################################################################
# Inbound Email — S3 Bucket Policy for SES
################################################################################

# Allow SES to write inbound emails to the documents bucket
resource "aws_s3_bucket_policy" "ses_inbound" {
  count  = var.documents_bucket_name != "" ? 1 : 0
  bucket = var.documents_bucket_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSESPuts"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${var.documents_bucket_arn}/inbound-emails/*"
        Condition = {
          StringEquals = {
            "AWS:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

################################################################################
# Inbound Email — SNS Topic
################################################################################

resource "aws_sns_topic" "inbound_email" {
  count = var.documents_bucket_name != "" ? 1 : 0
  name  = "${local.name_prefix}-ses-inbound"

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-ses-inbound"
  })
}

################################################################################
# Inbound Email — SES Receipt Rule Set & Rule
################################################################################

resource "aws_ses_receipt_rule_set" "inbound" {
  count         = var.documents_bucket_name != "" ? 1 : 0
  rule_set_name = "${local.name_prefix}-inbound"
}

resource "aws_ses_active_receipt_rule_set" "inbound" {
  count         = var.documents_bucket_name != "" ? 1 : 0
  rule_set_name = aws_ses_receipt_rule_set.inbound[0].rule_set_name
}

resource "aws_ses_receipt_rule" "catch_all" {
  count         = var.documents_bucket_name != "" ? 1 : 0
  name          = "${local.name_prefix}-catch-all"
  rule_set_name = aws_ses_receipt_rule_set.inbound[0].rule_set_name
  recipients    = [var.domain]
  enabled       = true
  scan_enabled  = true

  s3_action {
    bucket_name       = var.documents_bucket_name
    object_key_prefix = "inbound-emails/"
    position          = 1
  }

  sns_action {
    topic_arn = aws_sns_topic.inbound_email[0].arn
    encoding  = "UTF-8"
    position  = 2
  }

  depends_on = [aws_s3_bucket_policy.ses_inbound[0]]
}

################################################################################
# Inbound Email — Lambda Function
################################################################################

data "archive_file" "ses_lambda" {
  count       = var.documents_bucket_name != "" ? 1 : 0
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "ses_inbound" {
  count            = var.documents_bucket_name != "" ? 1 : 0
  filename         = data.archive_file.ses_lambda[0].output_path
  source_code_hash = data.archive_file.ses_lambda[0].output_base64sha256
  function_name    = "${local.name_prefix}-ses-inbound"
  role             = aws_iam_role.lambda_ses[0].arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      WEBHOOK_URL         = "https://${var.domain}/api/webhooks/ses-inbound"
      S3_BUCKET           = var.documents_bucket_name
      WEBHOOK_SECRET      = var.webhook_secret
    }
  }

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-ses-inbound"
  })
}

# Allow SNS to invoke Lambda
resource "aws_lambda_permission" "sns_invoke" {
  count         = var.documents_bucket_name != "" ? 1 : 0
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ses_inbound[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.inbound_email[0].arn
}

# SNS → Lambda subscription
resource "aws_sns_topic_subscription" "lambda" {
  count     = var.documents_bucket_name != "" ? 1 : 0
  topic_arn = aws_sns_topic.inbound_email[0].arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.ses_inbound[0].arn
}

################################################################################
# Inbound Email — Lambda IAM Role
################################################################################

resource "aws_iam_role" "lambda_ses" {
  count = var.documents_bucket_name != "" ? 1 : 0
  name  = "${local.name_prefix}-lambda-ses-inbound"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-lambda-ses-inbound"
  })
}

resource "aws_iam_role_policy" "lambda_ses" {
  count = var.documents_bucket_name != "" ? 1 : 0
  name  = "${local.name_prefix}-lambda-ses-policy"
  role  = aws_iam_role.lambda_ses[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Sid    = "AllowS3Read"
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = "${var.documents_bucket_arn}/inbound-emails/*"
      }
    ]
  })
}
