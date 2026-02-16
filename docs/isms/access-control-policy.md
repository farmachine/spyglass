# Access Control Policy

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Document ID**  | ISMS-POL-002                               |
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

This Access Control Policy defines the requirements and controls for managing user access to Extrapl information systems, applications, and data. It ensures that access is granted based on business need, follows the principle of least privilege, and is subject to regular review.

This policy is aligned with ISO/IEC 27001:2022 Annex A, Control A.8 (Technological Controls), and supports the Extrapl Information Security Policy (ISMS-POL-001).

## 2. Scope

This policy applies to:

- All Extrapl information systems, including the Extrapl SaaS platform, internal tools, AWS infrastructure, CI/CD pipelines, and third-party services.
- All users who access Extrapl systems, including employees, contractors, consultants, and third-party service providers.
- All types of access, including physical, logical, local, and remote access.

## 3. Access Control Principles

The following principles govern access control at Extrapl:

1. **Least Privilege**: Users shall be granted the minimum level of access necessary to perform their job functions.
2. **Need-to-Know**: Access to information is restricted to individuals who require it for their role.
3. **Separation of Duties**: Critical tasks shall be divided among multiple individuals to reduce the risk of fraud, error, or unauthorized activity.
4. **Default Deny**: Access is denied by default; explicit authorization is required before access is granted.
5. **Defense in Depth**: Multiple layers of access control are implemented to protect information assets.

## 4. User Access Management

### 4.1 User Registration and De-Registration

| Process | Requirement |
|---------|-------------|
| New user accounts | Created only upon receipt of an approved access request from the user's manager |
| Account provisioning | Completed within [PROVISIONING_SLA] business days of approval |
| Unique identifiers | Every user shall have a unique user ID; shared accounts are prohibited |
| Account de-provisioning | Disabled within 24 hours of termination or role change notification |
| Temporary accounts | Must have a defined expiry date, not exceeding 90 days without renewal |

### 4.2 Access Provisioning Process

1. **Request**: User or manager submits an access request specifying the systems, roles, and permissions required.
2. **Approval**: The request is approved by the user's direct manager and the system owner.
3. **Provisioning**: The IT/Security team provisions access according to the approved request.
4. **Confirmation**: The user is notified of the access granted and any associated responsibilities.
5. **Documentation**: All access grants are logged in the access management system.

### 4.3 Privileged Access Management

Privileged accounts (administrator, root, service accounts) require additional controls:

| Control | Requirement |
|---------|-------------|
| Approval | Requires CISO or CTO approval in addition to standard approval |
| Scope | Privileged access is granted only for specific tasks and time periods where possible |
| Separate accounts | Administrators must use separate privileged accounts distinct from their standard user accounts |
| Logging | All privileged account activity shall be logged and monitored |
| MFA | Multi-factor authentication is mandatory for all privileged access |
| Review | Privileged accounts are reviewed monthly |
| Break-glass | Emergency access procedures are documented and require post-use review |

### 4.4 Service Accounts

- Service accounts shall be created only when necessary for system-to-system communication.
- Service accounts shall have a designated human owner responsible for the account.
- Service account credentials shall be stored in a secrets manager (e.g., AWS Secrets Manager).
- Service accounts shall not be used for interactive login.
- Service account permissions shall be reviewed quarterly.

## 5. Authentication Requirements

### 5.1 Multi-Factor Authentication (MFA)

MFA is **mandatory** for the following:

| System/Access Type | MFA Requirement |
|--------------------|-----------------|
| AWS Console and CLI access | Required (hardware token or authenticator app) |
| GitHub organization access | Required (authenticator app or security key) |
| Production infrastructure access | Required |
| VPN / Remote access | Required |
| Extrapl admin panel | Required |
| Third-party SaaS tools (critical) | Required where supported |
| CI/CD pipeline secrets access | Required |

MFA methods accepted (in order of preference):

1. Hardware security keys (FIDO2/WebAuthn)
2. Authenticator applications (TOTP)
3. Push notifications from approved identity providers

SMS-based MFA is **not permitted** due to known vulnerabilities.

### 5.2 Password Policy

All passwords must meet the following requirements:

| Parameter | Requirement |
|-----------|-------------|
| Minimum length | 12 characters |
| Complexity | Must contain at least three of: uppercase letters, lowercase letters, numbers, special characters |
| Maximum age | 90 days (365 days if MFA is enabled) |
| Minimum age | 1 day (to prevent immediate reuse cycling) |
| History | Cannot reuse the last 12 passwords |
| Lockout threshold | 5 consecutive failed attempts |
| Lockout duration | 15 minutes (automatic unlock) or manual unlock by IT |
| Default passwords | Must be changed on first login |
| Storage | Passwords must be hashed using bcrypt, scrypt, or Argon2; never stored in plaintext |
| Transmission | Passwords must only be transmitted over encrypted channels (TLS 1.2+) |

### 5.3 Password Manager

- All employees are required to use an approved password manager for storing work-related credentials.
- Browser-based password storage is discouraged; enterprise password managers are preferred.
- Master passwords for password managers must meet the password policy requirements.

## 6. Access Reviews

### 6.1 Quarterly Access Reviews

| Review Type | Frequency | Scope | Responsible |
|-------------|-----------|-------|-------------|
| Standard user access | Quarterly | All user accounts and their permissions across systems | Department Managers |
| Privileged access | Monthly | All administrator and service accounts | CISO |
| Third-party access | Quarterly | All vendor and contractor accounts | CISO + Procurement |
| Dormant accounts | Monthly | Accounts with no login activity for 30+ days | IT/Security Team |
| Application-level permissions | Quarterly | Role assignments within the Extrapl platform | Product/Engineering Lead |

### 6.2 Access Review Process

1. **Preparation**: The Security team generates access reports for each system in scope.
2. **Review**: Designated reviewers validate that each user's access is appropriate for their current role.
3. **Action**: Access that is no longer required or appropriate is revoked or modified.
4. **Documentation**: Review results and remediation actions are documented.
5. **Escalation**: Unresolved access issues are escalated to the CISO within 5 business days.
6. **Sign-off**: Reviewers confirm completion of the review.

### 6.3 Trigger-Based Reviews

In addition to scheduled reviews, access reviews shall be performed when:

- An employee changes role or department.
- An employee is placed on leave or performance improvement plan.
- A security incident involves unauthorized access.
- A third-party contract is modified or terminated.
- Significant changes are made to a system's architecture or security posture.

## 7. Separation of Duties

The following duties shall be separated to reduce the risk of unauthorized or undetected actions:

| Duty Pair | Separation Requirement |
|-----------|----------------------|
| Code development / Production deployment | Different individuals must approve and deploy code |
| Access request / Access approval | Users cannot approve their own access requests |
| Change request / Change approval | Requesters cannot approve their own changes |
| Financial transaction initiation / Approval | Different individuals must initiate and approve |
| Security monitoring / System administration | Security monitoring shall be independent of the systems being monitored |
| Audit / Auditee | Internal auditors shall not audit their own work |

Where separation of duties is not feasible due to team size, compensating controls shall be implemented (e.g., enhanced logging, management review, automated alerts).

## 8. Remote Access

### 8.1 Remote Access Requirements

| Requirement | Details |
|-------------|---------|
| Authentication | MFA is required for all remote access |
| Encryption | All remote connections must use encrypted channels (VPN, SSH, TLS 1.2+) |
| Endpoint security | Remote devices must run approved endpoint protection and be kept up to date |
| Network segmentation | Remote access shall not provide unrestricted access to internal networks |
| Session management | Remote sessions shall timeout after 30 minutes of inactivity |
| Logging | All remote access sessions shall be logged, including source IP, timestamp, and user identity |

### 8.2 Remote Access Methods

| Method | Use Case | Controls |
|--------|----------|----------|
| AWS SSM Session Manager | Infrastructure access | IAM roles, CloudTrail logging, no SSH keys required |
| VPN | Access to internal resources (if applicable) | MFA, certificate-based auth, split tunneling disabled |
| SSH (via bastion) | Emergency server access | Key-based auth only, session recording, time-limited |
| HTTPS | Web-based application access | TLS 1.2+, MFA, WAF protection |

### 8.3 BYOD (Bring Your Own Device)

- Personal devices used for work must comply with the endpoint security requirements.
- Access from personal devices is limited to web-based applications through the browser.
- Personal devices shall not store Extrapl data locally unless encrypted and approved.
- The organization reserves the right to require device security verification before granting access.

## 9. Application and Infrastructure Access

### 9.1 AWS Access Control

| Control | Implementation |
|---------|---------------|
| IAM policies | Follow least privilege; no wildcard (*) permissions in production |
| Root account | Disabled for daily use; protected with hardware MFA; usage triggers alerts |
| Role-based access | Use IAM roles for EC2/ECS/Lambda; avoid long-lived access keys |
| SCPs | AWS Organizations SCPs enforce guardrails across accounts |
| CloudTrail | All API calls logged and monitored |
| Access Analyzer | IAM Access Analyzer runs continuously to detect over-permissive policies |

### 9.2 Database Access

| Control | Implementation |
|---------|---------------|
| Network | RDS accessible only from application VPC subnets; no public access |
| Authentication | IAM database authentication where possible; strong passwords otherwise |
| Authorization | Application-level roles with minimum required permissions |
| Direct access | Direct database access requires CISO approval and is time-limited |
| Audit | Database query logging enabled for privileged operations |

### 9.3 Source Code Access

| Control | Implementation |
|---------|---------------|
| Repository access | Granted per team and role; no organization-wide write access |
| Branch protection | Main branch requires PR review and approval before merge |
| Secrets | No secrets in code; enforced by pre-commit hooks and CI scanning |
| Signed commits | Encouraged for all contributors; required for release branches |

## 10. Access Revocation

### 10.1 Termination / Offboarding

| Action | Timeline |
|--------|----------|
| Disable user accounts (all systems) | Within 24 hours of termination |
| Revoke VPN and remote access | Immediately upon notification |
| Revoke AWS IAM access | Within 4 hours |
| Rotate shared secrets the user had access to | Within 24 hours |
| Collect company-owned devices | Per HR offboarding process |
| Remove from communication channels | Within 24 hours |
| Complete offboarding checklist | Within 5 business days |

### 10.2 Role Change / Transfer

When an employee changes roles:

1. A new access request is submitted for the new role.
2. The previous manager reviews and confirms which access should be retained.
3. Access no longer needed for the new role is revoked within 5 business days.
4. The transfer is documented in the access management system.

## 11. Compliance and Enforcement

- Compliance with this policy is mandatory for all personnel within scope.
- Violations may result in disciplinary action, up to and including termination of employment or contract.
- Access control exceptions require documented approval from the CISO and must be time-limited.
- The CISO is responsible for monitoring compliance with this policy.

## 12. Related Documents

| Document | Document ID |
|----------|-------------|
| Information Security Policy | ISMS-POL-001 |
| Risk Assessment Methodology | ISMS-PROC-001 |
| Incident Response Plan | ISMS-PLAN-001 |
| Data Classification Policy | ISMS-POL-003 |
| Change Management Procedure | ISMS-PROC-002 |

## 13. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [DATE] | [AUTHOR] | Initial release |

## 14. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CISO | [CISO_NAME] | | [DATE] |
| CEO | [CEO_NAME] | | [DATE] |
