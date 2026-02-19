output "domain_identity_arn" {
  description = "ARN of the SES domain identity"
  value       = aws_ses_domain_identity.main.arn
}

output "verification_token" {
  description = "TXT record value for domain verification (add as TXT record for _amazonses.domain)"
  value       = aws_ses_domain_identity.main.verification_token
}

output "dkim_tokens" {
  description = "DKIM CNAME tokens (add 3 CNAME records: {token}._domainkey.domain -> {token}.dkim.amazonses.com)"
  value       = aws_ses_domain_dkim.main.dkim_tokens
}

output "mail_from_domain" {
  description = "MAIL FROM subdomain (add MX and SPF TXT records for this subdomain)"
  value       = aws_ses_domain_mail_from.main.mail_from_domain
}

output "dns_records_needed" {
  description = "Summary of DNS records that need to be added to your DNS provider"
  value = {
    verification_txt = {
      type  = "TXT"
      name  = "_amazonses.${var.domain}"
      value = aws_ses_domain_identity.main.verification_token
    }
    dkim_cnames = [
      for token in aws_ses_domain_dkim.main.dkim_tokens : {
        type  = "CNAME"
        name  = "${token}._domainkey.${var.domain}"
        value = "${token}.dkim.amazonses.com"
      }
    ]
    mail_from_mx = {
      type     = "MX"
      name     = "mail.${var.domain}"
      value    = "10 feedback-smtp.${data.aws_region.current.name}.amazonses.com"
      priority = 10
    }
    mail_from_spf = {
      type  = "TXT"
      name  = "mail.${var.domain}"
      value = "v=spf1 include:amazonses.com ~all"
    }
  }
}

data "aws_region" "current" {}
