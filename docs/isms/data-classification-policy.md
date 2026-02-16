# Data Classification Policy

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Document ID**  | ISMS-POL-003                               |
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

This Data Classification Policy establishes a framework for classifying information assets based on their sensitivity and criticality. It defines handling requirements for each classification level to ensure that information receives an appropriate level of protection throughout its lifecycle.

This policy is aligned with ISO/IEC 27001:2022 Annex A, Controls A.5.12 (Classification of Information) and A.5.13 (Labelling of Information), and supports the Extrapl Information Security Policy (ISMS-POL-001).

## 2. Scope

This policy applies to all information created, received, maintained, transmitted, or disposed of by Extrapl, regardless of format (digital, paper, verbal), including:

- Customer data processed and stored by the Extrapl SaaS platform.
- Internal business data and communications.
- Source code and technical documentation.
- Employee and contractor personal data.
- Third-party data received under contractual agreements.

All employees, contractors, and third parties who handle Extrapl information must comply with this policy.

## 3. Classification Levels

Extrapl uses four classification levels, from least to most sensitive:

### 3.1 Level 1: Public

| Attribute | Details |
|-----------|---------|
| Definition | Information explicitly approved for public disclosure. Unauthorized disclosure would have no adverse effect on Extrapl. |
| Default classification | No. Information must be explicitly classified as Public. |
| Approval required | Communications Lead or management approval required before publishing. |

### 3.2 Level 2: Internal

| Attribute | Details |
|-----------|---------|
| Definition | Information intended for use within Extrapl. Unauthorized disclosure could cause minor inconvenience or require minor remediation. |
| Default classification | Yes. All information is classified as Internal by default unless otherwise classified. |
| Access | Available to all Extrapl employees and authorized contractors. |

### 3.3 Level 3: Confidential

| Attribute | Details |
|-----------|---------|
| Definition | Sensitive information that, if disclosed, could cause significant harm to Extrapl, its customers, or its partners. Access is restricted to individuals with a specific business need. |
| Access | Restricted to individuals with explicit authorization and a demonstrated need-to-know. |
| Marking | Must be clearly labeled as "Confidential" in documents and systems. |

### 3.4 Level 4: Restricted

| Attribute | Details |
|-----------|---------|
| Definition | Highly sensitive information that, if disclosed, could cause severe harm to Extrapl, its customers, or individuals. Subject to the strictest access controls and handling requirements. |
| Access | Strictly limited to named individuals with explicit authorization from the data owner and CISO. |
| Marking | Must be clearly labeled as "Restricted" in all formats. |

## 4. Classification Matrix - Extrapl Data Examples

| Data Type | Classification | Rationale |
|-----------|---------------|-----------|
| Marketing website content | **Public** | Intended for public consumption |
| Product documentation (public) | **Public** | Published for customer use |
| Blog posts and announcements | **Public** | Approved for public distribution |
| Open-source contributions | **Public** | Intentionally shared |
| Internal meeting notes | **Internal** | General business operations |
| Project names and descriptions | **Internal** | General business context |
| Internal process documentation | **Internal** | Operational procedures |
| Non-sensitive Slack conversations | **Internal** | Day-to-day communications |
| Team structure and org charts | **Internal** | General organizational information |
| Sprint and roadmap plans | **Internal** | Business planning |
| Customer extraction data and results | **Confidential** | Customer business data processed by the platform |
| Customer uploaded documents | **Confidential** | Customer-owned sensitive documents |
| Customer account information (names, emails, organizations) | **Confidential** | Customer PII and business information |
| Application source code | **Confidential** | Proprietary intellectual property |
| API keys and service tokens (non-production) | **Confidential** | Access credentials for non-production environments |
| Infrastructure architecture diagrams | **Confidential** | Security-sensitive technical details |
| Security audit reports | **Confidential** | Contains vulnerability information |
| Penetration test results | **Confidential** | Contains exploitable findings |
| Financial records and projections | **Confidential** | Sensitive business data |
| Employee personal data (HR records) | **Confidential** | Protected under privacy regulations |
| Incident response reports | **Confidential** | Contains security details |
| User authentication credentials (hashed passwords) | **Restricted** | Must be protected at the highest level |
| Encryption keys and master secrets | **Restricted** | Compromise would undermine all data protection |
| Production database credentials | **Restricted** | Direct access to customer data |
| Production API keys and service tokens | **Restricted** | Access to production systems and third-party services |
| AWS root account credentials | **Restricted** | Unrestricted infrastructure access |
| Customer payment information | **Restricted** | Subject to PCI-DSS; highest sensitivity |
| Data breach investigation details (active) | **Restricted** | Legal and regulatory sensitivity |
| Encryption private keys and certificates | **Restricted** | Cryptographic integrity |

## 5. Handling Requirements

### 5.1 Storage

| Requirement | Public | Internal | Confidential | Restricted |
|-------------|--------|----------|-------------|------------|
| Encryption at rest | Not required | Recommended | Required (AES-256) | Required (AES-256, dedicated keys) |
| Storage location | Any | Approved business systems | Approved, access-controlled systems only | Dedicated secure storage with audit logging |
| Cloud storage | Any provider | Approved providers (AWS, GitHub) | Approved providers with encryption | AWS with customer-managed KMS keys |
| Local storage | Permitted | Permitted | Avoid; if necessary, full disk encryption required | Prohibited on local devices |
| Backup | Standard | Standard | Encrypted backups; tested restoration | Encrypted backups; restricted access; tested restoration |

### 5.2 Transmission

| Requirement | Public | Internal | Confidential | Restricted |
|-------------|--------|----------|-------------|------------|
| Email | Permitted | Permitted (internal addresses only for bulk) | Encrypted (TLS required) | Prohibited via standard email; use approved secure channels |
| File transfer | Any method | Approved tools | Encrypted channels only (SFTP, HTTPS) | Encrypted channels with recipient verification |
| Messaging (Slack, etc.) | Permitted | Permitted | Permitted in private channels only | Prohibited; use approved secure channels |
| API transmission | HTTPS recommended | HTTPS required | HTTPS required (TLS 1.2+) | HTTPS required (TLS 1.2+), mutual TLS where possible |
| Physical media | N/A | Sealed envelope | Encrypted media, tracked delivery | Encrypted media, tracked and signed delivery |

### 5.3 Access Control

| Requirement | Public | Internal | Confidential | Restricted |
|-------------|--------|----------|-------------|------------|
| Authentication | Not required | Standard authentication | MFA required | MFA required + additional verification |
| Authorization | Open access | Role-based access | Explicit need-to-know authorization | Named individual authorization by data owner + CISO |
| Access review | Not required | Quarterly | Quarterly | Monthly |
| Logging | Not required | Standard logging | All access logged | All access logged and monitored in real-time |

### 5.4 Labelling

| Requirement | Public | Internal | Confidential | Restricted |
|-------------|--------|----------|-------------|------------|
| Documents | "Public" label optional | No label required (default) | "Confidential" in header/footer | "RESTRICTED" in header/footer, watermark |
| Emails | No label required | No label required | [CONFIDENTIAL] in subject line | [RESTRICTED] in subject line |
| Files/folders | No label required | No label required | "Confidential" in filename or metadata | "RESTRICTED" in filename or metadata |
| Database fields | No marking | No marking | Tagged in data catalog | Tagged in data catalog with restricted flag |
| S3 buckets/objects | Public bucket tags | Standard tags | Confidential tag; bucket policy enforced | Restricted tag; bucket policy + object-level encryption |

### 5.5 Disposal

| Requirement | Public | Internal | Confidential | Restricted |
|-------------|--------|----------|-------------|------------|
| Digital data | Standard deletion | Standard deletion | Secure deletion (overwrite or crypto-shredding) | Verified secure deletion with certificate of destruction |
| Paper documents | Standard recycling | Shredding (cross-cut) | Shredding (cross-cut) with witnessed destruction | Shredding (cross-cut) with witnessed destruction and certificate |
| Storage media | Standard disposal | Secure wipe | Secure wipe or physical destruction | Physical destruction with certificate |
| Backup data | Per backup lifecycle | Per backup lifecycle | Crypto-shredding when key is destroyed | Crypto-shredding with verification |

## 6. Classification Responsibilities

### 6.1 Data Owners

- Assign the initial classification level to information assets under their responsibility.
- Review and update classifications when the sensitivity or context changes.
- Authorize access to Confidential and Restricted information.
- Ensure that classification is communicated to all users who handle the data.

### 6.2 Data Custodians (IT/Engineering)

- Implement and maintain technical controls appropriate to each classification level.
- Ensure that storage, transmission, and access controls meet the requirements of this policy.
- Report any deviations from the handling requirements to the data owner and CISO.

### 6.3 All Personnel

- Handle information in accordance with its classification level.
- Apply the correct classification when creating new information (or accept the default of Internal).
- Report suspected misclassification or mishandling to the CISO.
- When in doubt about classification, treat information as Confidential until clarified.

## 7. Reclassification

Information may be reclassified when:

- The sensitivity of the information changes (e.g., a product becomes publicly announced).
- Regulatory or contractual requirements change.
- The information reaches end-of-life (e.g., time-limited confidentiality).
- A data owner determines the current classification is no longer appropriate.

Reclassification must be:

1. Approved by the data owner (upgrade or downgrade).
2. Downgrading from Restricted requires CISO approval.
3. Documented in the asset register.
4. Communicated to all current holders of the information.
5. Reflected in labelling and access controls.

## 8. Exceptions

Exceptions to this policy must be:

- Requested in writing with justification.
- Approved by the CISO.
- Time-limited (maximum 90 days; renewable with re-approval).
- Documented in the exception register.
- Subject to compensating controls as determined by the CISO.

## 9. Compliance and Enforcement

- Compliance with this policy is mandatory for all personnel within scope.
- Violations may result in disciplinary action, up to and including termination of employment or contract.
- Deliberate mishandling of Restricted data may result in immediate termination and potential legal action.
- The CISO is responsible for monitoring compliance with this policy.

## 10. Related Documents

| Document | Document ID |
|----------|-------------|
| Information Security Policy | ISMS-POL-001 |
| Access Control Policy | ISMS-POL-002 |
| Data Retention Policy | ISMS-POL-004 |
| Risk Assessment Methodology | ISMS-PROC-001 |
| Incident Response Plan | ISMS-PLAN-001 |

## 11. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [DATE] | [AUTHOR] | Initial release |

## 12. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CISO | [CISO_NAME] | | [DATE] |
| CEO | [CEO_NAME] | | [DATE] |
