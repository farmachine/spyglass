################################################################################
# S3 Module - Outputs
################################################################################

output "bucket_name" {
  description = "Name of the document storage bucket"
  value       = aws_s3_bucket.documents.id
}

output "bucket_arn" {
  description = "ARN of the document storage bucket"
  value       = aws_s3_bucket.documents.arn
}

output "bucket_domain_name" {
  description = "Domain name of the document storage bucket"
  value       = aws_s3_bucket.documents.bucket_domain_name
}

output "access_log_bucket_id" {
  description = "ID of the access logging bucket"
  value       = aws_s3_bucket.access_logs.id
}

output "access_log_bucket_arn" {
  description = "ARN of the access logging bucket"
  value       = aws_s3_bucket.access_logs.arn
}
