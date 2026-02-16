# Data Retention Policy

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Document ID**  | ISMS-POL-004                               |
| **Version**      | 1.0                                        |
| **Classification**| Internal                                  |
| **Effective Date**| [EFFECTIVE_DATE]                          |
| **Review Date**  | [REVIEW_DATE]                              |
| **Owner**        | [CISO_NAME], Chief Information Security Officer |
| **Reviewer**     | [REVIEWER_NAME], [REVIEWER_TITLE]          |
| **Approver**     | [CEO_NAME], Chief Executive Officer        |
| **Status**       | Draft                                      |

---

## 1. Purpose

This Data Retention Policy defines the requirements for retaining, archiving, and disposing of data across Extrapl systems and services. It ensures that data is retained for the minimum period necessary to meet business, legal, and regulatory requirements, and that data is securely disposed of when no longer needed.

This policy is aligned with ISO/IEC 27001:2022 Annex A, Control A.5.33 (Protection of Records), and supports the Extrapl Information Security Policy (ISMS-POL-001) and Data Classification Policy (ISMS-POL-003).

## 2. Scope

This policy applies to all data created, received, processed, stored, or transmitted by Extrapl, including:

- Customer data stored in the Extrapl SaaS platform (extraction data, uploaded documents, project data).
- User account data (profiles, authentication records, session data).
- Application and infrastructure logs.
- Audit trail records.
- Database backups and snapshots.
- Business records (financial, contractual, HR).
- Communication records.

## 3. Retention Principles

1. **Minimum Necessary**: Data shall be retained only for as long as required to fulfill its original purpose, meet legal or regulatory obligations, or satisfy contractual requirements.
2. **Purpose Limitation**: Data retained beyond its original purpose must have a documented and justified reason.
3. **Secure Storage**: Retained data must be stored securely and in accordance with the Data Classification Policy (ISMS-POL-003).
4. **Timely Disposal**: Data must be securely disposed of promptly once the retention period expires and no exception applies.
5. **Verifiability**: Retention and disposal activities must be documented and auditable.

## 4. Retention Schedule

### 4.1 Customer and Platform Data

| Data Type | Description | Retention Period | Storage Location | Disposal Method |
|-----------|------------|-----------------|-----------------|-----------------|
| Extraction session data | AI extraction inputs, outputs, and metadata | **2 years** from session completion | RDS (PostgreSQL) + S3 | Secure deletion from database; S3 object deletion with versioning cleanup |
| Customer uploaded documents | Source documents uploaded for extraction | **2 years** from upload date (or per customer contract) | S3 (encrypted) | S3 object deletion with versioning cleanup |
| Extraction results/exports | Processed data outputs and exports | **2 years** from creation date | S3 (encrypted) | S3 object deletion with versioning cleanup |
| Project data | Project names, configurations, and metadata | Active account period + **90 days** | RDS (PostgreSQL) | Secure database deletion |
| User session tokens | Active login sessions | **24 hours** (idle timeout) / **7 days** (maximum) | Application memory / Redis | Automatic expiration |

### 4.2 User Account Data

| Data Type | Description | Retention Period | Storage Location | Disposal Method |
|-----------|------------|-----------------|-----------------|-----------------|
| Active user accounts | User profiles, email, preferences | Duration of active account | RDS (PostgreSQL) | See account deletion process (Section 5) |
| Inactive user accounts | Accounts with no login for 12+ months | Active period + **90 days** after deactivation notice | RDS (PostgreSQL) | Secure database deletion; anonymization of associated records |
| Deleted user accounts | User-requested or admin-deleted accounts | **90 days** post-deletion request (soft delete), then permanent removal | RDS (PostgreSQL) | Permanent deletion from database; anonymization of audit records |
| Authentication records | Login history, MFA enrollment | Active account period + **90 days** | RDS (PostgreSQL) | Secure database deletion |
| Password hashes | Hashed user passwords | Until password change or account deletion | RDS (PostgreSQL) | Overwritten on change; deleted with account |

### 4.3 Logs and Audit Records

| Data Type | Description | Retention Period | Storage Location | Disposal Method |
|-----------|------------|-----------------|-----------------|-----------------|
| Application audit logs | User actions, data access, security events | **1 year** | CloudWatch Logs / S3 | Automatic lifecycle expiration |
| Infrastructure logs | ECS task logs, ALB access logs | **90 days** (CloudWatch) / **1 year** (archived to S3) | CloudWatch Logs --> S3 | CloudWatch retention policy; S3 lifecycle policy |
| AWS CloudTrail logs | API call records across AWS services | **1 year** | S3 (dedicated trail bucket) | S3 lifecycle policy |
| Security event logs | GuardDuty findings, WAF logs, failed auth | **1 year** | CloudWatch Logs / S3 | Automatic lifecycle expiration |
| Database query logs | Slow queries, privileged operations | **90 days** | CloudWatch Logs | CloudWatch retention policy |
| CI/CD pipeline logs | Build, test, and deployment records | **90 days** | GitHub Actions | GitHub retention settings |

### 4.4 Backups

| Data Type | Description | Retention Period | Storage Location | Disposal Method |
|-----------|------------|-----------------|-----------------|-----------------|
| RDS automated backups | Daily database snapshots | **30 days** | AWS RDS (primary region) | Automatic expiration |
| RDS manual snapshots | Pre-deployment and milestone snapshots | **90 days** (unless tagged for extended retention) | AWS RDS (primary + DR region) | Manual deletion after review |
| S3 object versions | Previous versions of customer files | **30 days** | S3 (versioned bucket) | S3 lifecycle policy (noncurrent version expiration) |
| Terraform state backups | Infrastructure state files | **1 year** (versioned) | S3 (state bucket) | S3 lifecycle policy |

### 4.5 Business Records

| Data Type | Description | Retention Period | Storage Location | Disposal Method |
|-----------|------------|-----------------|-----------------|-----------------|
| Financial records | Invoices, payment records, tax documents | **7 years** | Accounting system / secure storage | Secure deletion after retention period |
| Contracts and agreements | Customer contracts, vendor agreements, NDAs | Duration of agreement + **7 years** | Secure document storage | Secure deletion after retention period |
| Employee records | HR records, employment contracts | Duration of employment + **7 years** | HR system / secure storage | Secure deletion after retention period |
| Insurance records | Policies and claims | Duration of policy + **7 years** | Secure document storage | Secure deletion after retention period |

## 5. Account Deletion Process

### 5.1 User-Requested Deletion

When a user requests account deletion:

| Step | Action | Timeline |
|------|--------|----------|
| 1 | Acknowledge deletion request | Within 2 business days |
| 2 | Verify requester identity | Before proceeding |
| 3 | Soft-delete account (disable login, mark for deletion) | Within 5 business days |
| 4 | Notify user of soft-delete and 30-day recovery window | Immediately after soft-delete |
| 5 | If no cancellation received, permanently delete user profile data | 90 days after soft-delete |
| 6 | Delete or anonymize associated extraction data | 90 days after soft-delete |
| 7 | Anonymize audit log entries (replace user ID with hash) | 90 days after soft-delete |
| 8 | Confirm deletion to user | Within 5 business days of permanent deletion |

### 5.2 Regulatory Deletion Requests (GDPR Right to Erasure)

| Requirement | Implementation |
|-------------|---------------|
| Response time | Within 30 days of verified request |
| Scope | All personal data unless legal basis for retention exists |
| Exceptions | Data required for legal compliance, contractual obligations, or legitimate interest (documented) |
| Verification | Identity verification required before processing |
| Documentation | Deletion request and actions taken recorded in privacy register |
| Notification | Third parties with whom data was shared are notified |

## 6. Disposal Methods

### 6.1 Digital Data Disposal

| Classification | Method | Verification |
|---------------|--------|-------------|
| Public | Standard deletion | None required |
| Internal | Standard deletion | Spot check |
| Confidential | Secure deletion (crypto-shredding or multi-pass overwrite) | Documented confirmation |
| Restricted | Verified secure deletion with certificate of destruction | Certificate of destruction signed by responsible party |

### 6.2 Specific Disposal Procedures

| System | Disposal Procedure |
|--------|-------------------|
| RDS (PostgreSQL) | DELETE statements with verification; for bulk deletion, truncate with logged confirmation |
| S3 objects | Delete all object versions and delete markers; verify bucket is empty for full cleanup |
| CloudWatch Logs | Automatic expiration via retention policy; manual deletion for specific log groups if needed |
| EBS volumes | Encrypted volumes; deletion includes key material invalidation |
| Secrets Manager | Secret deletion with recovery window (7-30 days), then permanent removal |
| Local devices | Full disk wipe using approved tools; verified before device reassignment or disposal |

### 6.3 Disposal Records

All disposal activities for Confidential and Restricted data shall be documented with:

- Data description and classification
- Disposal method used
- Date of disposal
- Person responsible for disposal
- Verification method and result
- Certificate of destruction (for Restricted data)

## 7. Exceptions

### 7.1 Legal Hold

When data is subject to a legal hold (litigation, regulatory investigation, or audit):

- Affected data must be preserved regardless of the standard retention period.
- Legal holds override the standard disposal schedule.
- Legal counsel must issue and authorize all legal holds.
- Legal holds are communicated to relevant data custodians.
- Data under legal hold is clearly marked and segregated where possible.
- Legal holds are reviewed quarterly and lifted when no longer required.

### 7.2 Extended Retention

Requests to retain data beyond the standard retention period must be:

1. Submitted in writing with business justification.
2. Approved by the data owner and CISO.
3. Time-limited (maximum extension of 12 months; renewable with re-approval).
4. Documented in the retention exception register.
5. Subject to the same security controls as the original data classification.

### 7.3 Early Disposal

Requests to dispose of data before the retention period expires must be:

1. Approved by the data owner and Legal (if applicable).
2. Verified to not conflict with any legal, regulatory, or contractual requirements.
3. Documented in the retention exception register.

## 8. Monitoring and Compliance

### 8.1 Automated Controls

| Control | Implementation |
|---------|---------------|
| S3 lifecycle policies | Automated transition and expiration rules per retention schedule |
| CloudWatch log retention | Configured per log group to match retention requirements |
| RDS backup retention | Configured to 30 days; automated snapshot cleanup |
| Database retention jobs | Scheduled jobs to identify and purge data past retention period |
| Dormant account detection | Automated identification of inactive accounts (12+ months) |

### 8.2 Manual Reviews

| Review | Frequency | Responsible |
|--------|-----------|-------------|
| Retention schedule review | Annually | CISO + Legal |
| Disposal verification audit | Quarterly | Internal Audit |
| Legal hold review | Quarterly | Legal |
| Exception register review | Quarterly | CISO |
| S3 lifecycle policy validation | Semi-annually | Infrastructure Lead |
| Database retention job verification | Quarterly | Application Lead |

### 8.3 Metrics

| Metric | Target |
|--------|--------|
| Data disposed within 30 days of retention expiry | > 95% |
| Disposal records complete for Confidential/Restricted data | 100% |
| Legal holds reviewed on schedule | 100% |
| Retention exceptions documented and approved | 100% |
| User deletion requests completed within SLA | 100% |

## 9. Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| **CISO** | Policy owner; approves exceptions; oversees compliance |
| **Data Owners** | Classify data; define retention needs; approve disposal |
| **Infrastructure Lead** | Implement automated retention and disposal controls |
| **Application Lead** | Implement application-level retention logic and deletion procedures |
| **Legal** | Advise on legal and regulatory retention requirements; manage legal holds |
| **All Personnel** | Comply with retention requirements; report data handling concerns |

## 10. Related Documents

| Document | Document ID |
|----------|-------------|
| Information Security Policy | ISMS-POL-001 |
| Data Classification Policy | ISMS-POL-003 |
| Access Control Policy | ISMS-POL-002 |
| Business Continuity Plan | ISMS-PLAN-002 |
| Risk Assessment Methodology | ISMS-PROC-001 |

## 11. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [DATE] | [AUTHOR] | Initial release |

## 12. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CISO | [CISO_NAME] | | [DATE] |
| CEO | [CEO_NAME] | | [DATE] |
