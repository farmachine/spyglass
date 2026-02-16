################################################################################
# DNS Module - Outputs
################################################################################

output "zone_id" {
  description = "ID of the Route 53 hosted zone"
  value       = aws_route53_zone.main.zone_id
}

output "zone_name" {
  description = "Name of the Route 53 hosted zone"
  value       = aws_route53_zone.main.name
}

output "nameservers" {
  description = "Nameservers for the Route 53 hosted zone (configure at domain registrar)"
  value       = aws_route53_zone.main.name_servers
}

output "certificate_arn" {
  description = "ARN of the validated ACM certificate"
  value       = aws_acm_certificate_validation.main.certificate_arn
}

output "certificate_domain" {
  description = "Domain name of the ACM certificate"
  value       = aws_acm_certificate.main.domain_name
}

output "root_record_fqdn" {
  description = "FQDN of the root domain A record"
  value       = aws_route53_record.root.fqdn
}

output "wildcard_record_fqdn" {
  description = "FQDN of the wildcard A record"
  value       = aws_route53_record.wildcard.fqdn
}
