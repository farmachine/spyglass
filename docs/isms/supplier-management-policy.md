# Supplier Management Policy

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Document ID**  | ISMS-POL-005                               |
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

This Supplier Management Policy defines the requirements for assessing, selecting, monitoring, and managing third-party suppliers and service providers that process, store, transmit, or have access to Extrapl information assets. It ensures that supplier relationships do not introduce unacceptable risks to the confidentiality, integrity, and availability of Extrapl information.

This policy is aligned with ISO/IEC 27001:2022 Annex A, Controls A.5.19 through A.5.22, and supports the Extrapl Information Security Policy (ISMS-POL-001).

## 2. Scope

This policy applies to all third-party suppliers, service providers, and partners that:

- Process, store, or transmit Extrapl or customer data.
- Provide infrastructure, platform, or software services used by Extrapl.
- Have access to Extrapl systems, networks, or physical premises.
- Develop or maintain software or systems on behalf of Extrapl.

This includes cloud service providers, SaaS vendors, API service providers, contractors, consultants, and managed service providers.

## 3. Supplier Classification

### 3.1 Risk-Based Classification

Suppliers are classified into tiers based on the criticality of the service they provide and their level of access to Extrapl information:

| Tier | Classification | Criteria | Assessment Frequency |
|------|---------------|----------|---------------------|
| **Tier 1** | Critical | Supplier directly processes or stores customer data; service is essential to platform operation; failure would cause P1/P2 incident | Annually (comprehensive) |
| **Tier 2** | Important | Supplier has access to Internal or Confidential data; service supports key business functions; failure would cause degraded operation | Annually (standard) |
| **Tier 3** | Standard | Supplier provides general business services; limited or no access to sensitive data; alternative suppliers readily available | Every 2 years |

### 3.2 Current Supplier Register

| Supplier | Service Provided | Tier | Data Access | Contract Status | Last Assessment | Next Assessment |
|----------|-----------------|------|-------------|-----------------|-----------------|-----------------|
| **Amazon Web Services (AWS)** | Cloud infrastructure (ECS, RDS, S3, VPC, Route 53, CloudFront, IAM, KMS, Secrets Manager, CloudWatch, GuardDuty, CloudTrail) | Tier 1 - Critical | Restricted / Confidential: Hosts all customer data, application, and infrastructure | Active | [LAST_ASSESSMENT_DATE] | [NEXT_ASSESSMENT_DATE] |
| **Google (Gemini API)** | AI/ML model API for data extraction processing | Tier 1 - Critical | Confidential: Customer extraction data is sent to the API for processing | Active | [LAST_ASSESSMENT_DATE] | [NEXT_ASSESSMENT_DATE] |
| **AgentMail** | Email-based extraction ingestion service | Tier 2 - Important | Confidential: Receives customer documents via email for extraction | Active | [LAST_ASSESSMENT_DATE] | [NEXT_ASSESSMENT_DATE] |
| **Neon** | Managed PostgreSQL database (legacy; being migrated off) | Tier 1 - Critical (Transitional) | Confidential: Stores customer data for legacy/migrating customers | Active (Migration in progress) | [LAST_ASSESSMENT_DATE] | [NEXT_ASSESSMENT_DATE] |
| **GitHub** | Source code hosting, CI/CD (GitHub Actions), security scanning | Tier 2 - Important | Confidential: Source code, CI/CD secrets, security scan results | Active | [LAST_ASSESSMENT_DATE] | [NEXT_ASSESSMENT_DATE] |
| **[PAYMENT_PROVIDER]** | Payment processing and subscription management | Tier 1 - Critical | Restricted: Customer payment information | Active | [LAST_ASSESSMENT_DATE] | [NEXT_ASSESSMENT_DATE] |
| **[DOMAIN_REGISTRAR]** | Domain registration and DNS management | Tier 3 - Standard | Internal: Domain configuration | Active | [LAST_ASSESSMENT_DATE] | [NEXT_ASSESSMENT_DATE] |
| **[COMMUNICATION_TOOL]** | Internal communications (e.g., Slack) | Tier 3 - Standard | Internal: Business communications | Active | [LAST_ASSESSMENT_DATE] | [NEXT_ASSESSMENT_DATE] |

## 4. Supplier Assessment Criteria

### 4.1 Pre-Engagement Assessment

Before engaging a new supplier that will access Extrapl data or systems, the following assessment shall be completed:

| Assessment Area | Evaluation Criteria | Required For |
|----------------|-------------------|-------------|
| **Security certifications** | ISO 27001, SOC 2 Type II, or equivalent certification | Tier 1, Tier 2 |
| **Data protection** | Encryption at rest and in transit, data isolation, access controls | Tier 1, Tier 2, Tier 3 |
| **Incident response** | Documented incident response plan, notification procedures and timelines | Tier 1, Tier 2 |
| **Business continuity** | DR/BCP plans, SLA commitments, redundancy | Tier 1, Tier 2 |
| **Access control** | MFA, RBAC, privileged access management, audit logging | Tier 1, Tier 2 |
| **Regulatory compliance** | GDPR compliance, data processing agreements, data residency | Tier 1, Tier 2 |
| **Vulnerability management** | Regular scanning, patching SLAs, penetration testing | Tier 1, Tier 2 |
| **Sub-processor management** | Sub-processor disclosure, contractual flow-down, notification of changes | Tier 1 |
| **Financial stability** | Financial viability indicators, market presence | Tier 1 |
| **Data location** | Data residency and sovereignty requirements | Tier 1, Tier 2 |

### 4.2 Risk Assessment

Each supplier engagement shall include a risk assessment covering:

1. **Data exposure risk**: What data does the supplier access, process, or store?
2. **Availability risk**: What is the impact if the supplier's service becomes unavailable?
3. **Compliance risk**: Does the engagement introduce regulatory compliance obligations?
4. **Concentration risk**: Does the engagement create excessive dependency on a single supplier?
5. **Supply chain risk**: Does the supplier's supply chain introduce additional risks?
6. **Geopolitical risk**: Does the supplier's location or data residency create jurisdictional risks?

Risk assessment results shall be documented in the Risk Register and reviewed by the CISO.

### 4.3 Supplier-Specific Risk Assessments

#### AWS (Tier 1 - Critical)

| Risk Area | Assessment | Mitigation |
|-----------|-----------|------------|
| Data residency | Data stored in US regions (us-east-1) | Region-locked configuration via Terraform; SCP enforcement |
| Availability | Single cloud provider dependency | Multi-AZ deployment; cross-region backup; DR runbook |
| Access | AWS personnel access to infrastructure | AWS shared responsibility model; customer-managed encryption keys (KMS) |
| Compliance | SOC 2 Type II, ISO 27001 certified | Annual review of AWS compliance artifacts |
| Sub-processors | AWS uses sub-processors for certain services | Review AWS sub-processor list annually |

#### Google Gemini API (Tier 1 - Critical)

| Risk Area | Assessment | Mitigation |
|-----------|-----------|------------|
| Data processing | Customer extraction data sent to Google API | Review Google AI data usage policies; opt out of training data usage; contractual protections |
| Availability | Single AI model provider dependency | Queue-based architecture allows graceful degradation; evaluate alternative models |
| Data retention | Google may retain API inputs/outputs | Contractual data processing agreement; review retention policies |
| Quality/accuracy | AI model changes may affect extraction quality | Version pinning where possible; output validation; monitoring |

#### AgentMail (Tier 2 - Important)

| Risk Area | Assessment | Mitigation |
|-----------|-----------|------------|
| Data handling | Customer documents transmitted via email | TLS enforcement; data processing agreement |
| Availability | Email ingestion becomes unavailable | Alternative upload methods available (direct upload) |
| Data retention | Email data may be retained by provider | Contractual retention limits; regular review |

#### Neon (Tier 1 - Critical, Transitional)

| Risk Area | Assessment | Mitigation |
|-----------|-----------|------------|
| Data exposure | Customer data stored in Neon-managed PostgreSQL | Encryption at rest and in transit; access controls |
| Migration risk | Data integrity during migration to AWS RDS | Migration testing; data validation; parallel running period |
| Vendor lock-in | Neon-specific features | Standard PostgreSQL compatibility; migration plan in progress |
| Decommission | Secure data removal after migration | Verified data deletion; certificate of destruction |

## 5. Contractual Requirements

### 5.1 Mandatory Contractual Clauses

All supplier contracts involving access to Extrapl data shall include the following:

| Clause | Requirement | Tier Applicability |
|--------|-------------|-------------------|
| **Confidentiality/NDA** | Protection of confidential information | All tiers |
| **Data processing agreement** | GDPR-compliant DPA specifying processing purposes, data categories, and rights | Tier 1, Tier 2 |
| **Security requirements** | Minimum security controls (encryption, access control, logging) | Tier 1, Tier 2 |
| **Incident notification** | Obligation to notify Extrapl of security incidents within 24 hours (Tier 1) or 48 hours (Tier 2) | Tier 1, Tier 2 |
| **Audit rights** | Right to audit or request evidence of security controls | Tier 1, Tier 2 |
| **Sub-processor notification** | Obligation to notify of sub-processor changes with right to object | Tier 1 |
| **Data return/deletion** | Obligation to return or securely delete data upon termination | Tier 1, Tier 2 |
| **SLA commitments** | Defined uptime, response time, and support commitments | Tier 1, Tier 2 |
| **Termination provisions** | Reasonable notice period; data transition assistance; no data hostage | Tier 1, Tier 2 |
| **Liability and indemnification** | Appropriate liability provisions for data breaches | Tier 1, Tier 2 |
| **Compliance obligations** | Obligation to maintain relevant certifications and comply with applicable laws | Tier 1, Tier 2 |
| **Business continuity** | Obligation to maintain and test BCP/DR plans | Tier 1 |

### 5.2 Service Level Agreements

| Supplier | SLA Metric | Target | Measurement |
|----------|-----------|--------|-------------|
| AWS | Infrastructure availability | 99.99% (varies by service) | Per AWS SLA terms |
| Google Gemini | API availability | Per Google Cloud SLA | API error rate monitoring |
| AgentMail | Email processing availability | [SLA_TARGET] | Delivery and processing monitoring |
| Neon | Database availability | [SLA_TARGET] | Connection and query monitoring |
| GitHub | Service availability | 99.9% | GitHub status monitoring |

## 6. Ongoing Monitoring

### 6.1 Continuous Monitoring

| Monitoring Activity | Method | Frequency |
|-------------------|--------|-----------|
| Service availability | Automated monitoring, health checks | Continuous |
| Security advisory tracking | Vendor security bulletins, CVE feeds | Continuous |
| Compliance status | Vendor compliance portal, certification tracking | Quarterly |
| Incident reports | Vendor incident notifications, status pages | As they occur |
| Sub-processor changes | Vendor notifications | As they occur |
| Financial health | Public filings, market indicators (Tier 1 only) | Annually |

### 6.2 Periodic Reviews

| Review Activity | Tier 1 | Tier 2 | Tier 3 |
|----------------|--------|--------|--------|
| Full security assessment | Annually | Annually | Every 2 years |
| Compliance certificate review | Annually | Annually | N/A |
| Contract review | Annually | Annually | At renewal |
| SLA performance review | Quarterly | Semi-annually | Annually |
| Risk reassessment | Annually | Annually | Every 2 years |
| Penetration test results review | Annually | Where available | N/A |

### 6.3 Supplier Performance Metrics

| Metric | Target |
|--------|--------|
| SLA compliance | >= SLA target |
| Security incident notification within contractual timeframe | 100% |
| Compliance certifications maintained | 100% (Tier 1 and Tier 2) |
| Assessment completion on schedule | 100% |
| Open risk treatment actions | < [THRESHOLD] per supplier |

## 7. Supplier Lifecycle Management

### 7.1 Onboarding

| Step | Action | Responsible |
|------|--------|-------------|
| 1 | Identify supplier need and classify tier | Requesting team + CISO |
| 2 | Conduct pre-engagement security assessment | CISO / Security team |
| 3 | Negotiate and execute contract with required clauses | Legal + Procurement |
| 4 | Complete risk assessment and document in Risk Register | CISO |
| 5 | Configure access controls and monitoring | IT / Infrastructure team |
| 6 | Add supplier to the Supplier Register | CISO |
| 7 | Conduct initial security review / due diligence | CISO / Security team |

### 7.2 Ongoing Management

- Regular monitoring as defined in Section 6.
- Annual review meeting with Tier 1 suppliers to discuss security posture and roadmap.
- Prompt response to supplier-reported incidents per the Incident Response Plan (ISMS-PLAN-001).
- Re-assessment when significant changes occur (supplier acquisition, service changes, new data processing).

### 7.3 Offboarding / Termination

| Step | Action | Timeline | Responsible |
|------|--------|----------|-------------|
| 1 | Notify supplier of termination per contractual terms | Per contract | Procurement |
| 2 | Initiate data return or migration | Before termination effective date | Application / Infrastructure Lead |
| 3 | Verify all Extrapl data has been returned or migrated | Before termination | Data owner + CISO |
| 4 | Request and verify secure data deletion by supplier | Per contract (typically within 30 days) | CISO |
| 5 | Obtain certificate of data destruction (Tier 1) | Within 30 days of termination | CISO |
| 6 | Revoke all supplier access to Extrapl systems | On termination date | IT / Security team |
| 7 | Update Supplier Register | Within 5 business days | CISO |
| 8 | Archive supplier records per retention policy | Per Data Retention Policy | CISO |

## 8. Neon Migration Plan

As Neon is being migrated off as a database provider, the following specific controls apply:

| Phase | Actions | Status |
|-------|---------|--------|
| **Planning** | Migration plan documented; RDS target configured; data mapping complete | [STATUS] |
| **Parallel Running** | Data synchronized between Neon and AWS RDS; application reads/writes to both | [STATUS] |
| **Cutover** | Application pointed to AWS RDS; Neon connection disabled | [STATUS] |
| **Validation** | Data integrity verified; performance validated; monitoring confirmed | [STATUS] |
| **Decommission** | Neon data securely deleted; certificate of destruction obtained; contract terminated | [STATUS] |

## 9. Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| **CISO** | Policy owner; approves supplier assessments; maintains Supplier Register |
| **Legal** | Contract review and negotiation; DPA management; legal hold coordination |
| **Procurement** | Supplier engagement; contract management; renewal tracking |
| **Infrastructure Lead** | Technical integration; access provisioning; monitoring configuration |
| **Application Lead** | Application-level integration; data flow management |
| **Data Owners** | Approve data sharing with suppliers; participate in risk assessments |

## 10. Exceptions

Exceptions to this policy must be:

- Requested in writing with a documented risk assessment.
- Approved by the CISO.
- Time-limited (maximum 6 months; renewable with re-approval).
- Documented in the exception register.
- Subject to compensating controls as determined by the CISO.

## 11. Related Documents

| Document | Document ID |
|----------|-------------|
| Information Security Policy | ISMS-POL-001 |
| Risk Assessment Methodology | ISMS-PROC-001 |
| Data Classification Policy | ISMS-POL-003 |
| Data Retention Policy | ISMS-POL-004 |
| Incident Response Plan | ISMS-PLAN-001 |
| Business Continuity Plan | ISMS-PLAN-002 |

## 12. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [DATE] | [AUTHOR] | Initial release |

## 13. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CISO | [CISO_NAME] | | [DATE] |
| CEO | [CEO_NAME] | | [DATE] |
