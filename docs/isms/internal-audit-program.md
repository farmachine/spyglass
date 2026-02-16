# Internal Audit Program

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Document ID**  | ISMS-PROG-001                              |
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

This Internal Audit Program defines the framework for planning, conducting, and reporting on internal audits of the Extrapl Information Security Management System (ISMS). It ensures that the ISMS is effectively implemented, maintained, and continually improved in accordance with ISO/IEC 27001:2022 requirements.

This program is aligned with ISO/IEC 27001:2022 Clause 9.2 (Internal Audit) and ISO 19011 (Guidelines for Auditing Management Systems), and supports the Extrapl Information Security Policy (ISMS-POL-001).

## 2. Scope

The internal audit program covers all elements of the Extrapl ISMS, including:

- ISMS policies, procedures, and controls.
- ISO 27001:2022 Annex A controls applicable to Extrapl.
- Technical and operational security controls.
- AWS infrastructure security configuration.
- Application security controls.
- Data protection and privacy controls.
- Supplier and third-party management.
- Incident response and business continuity preparedness.
- Compliance with legal, regulatory, and contractual requirements.

## 3. Audit Objectives

The internal audit program aims to:

1. **Verify conformity**: Confirm that the ISMS conforms to ISO/IEC 27001:2022 requirements and Extrapl's own policies and procedures.
2. **Assess effectiveness**: Evaluate whether security controls are operating effectively to achieve their intended objectives.
3. **Identify improvement opportunities**: Discover areas where the ISMS can be strengthened or optimized.
4. **Verify compliance**: Confirm compliance with applicable legal, regulatory, and contractual obligations.
5. **Support management decisions**: Provide management with objective evidence about the state of information security.
6. **Prepare for certification**: Ensure readiness for external ISO 27001 certification audits.

## 4. Annual Audit Schedule

The audit program follows an annual cycle, with each quarter focusing on specific ISMS domains. All ISO 27001 clauses and applicable Annex A controls are covered at least once per year.

### 4.1 Q1: Access Control and Authentication (January - March)

| Audit Area | ISO 27001 Reference | Key Controls to Audit |
|-----------|---------------------|----------------------|
| User access management | A.5.15, A.5.16, A.5.17, A.5.18 | User registration/de-registration, access provisioning, privileged access, access review completion |
| Authentication controls | A.8.5 | MFA enforcement, password policy compliance, credential management |
| Identity management | A.5.16 | Unique user IDs, service account management, inactive account handling |
| Access review effectiveness | A.5.18 | Quarterly review completion, remediation actions, timeliness |
| AWS IAM configuration | A.8.2, A.8.3 | IAM policies, role-based access, least privilege, root account controls |
| Source code access | A.8.4 | Repository permissions, branch protection, secrets in code |
| Remote access controls | A.6.7, A.8.1 | VPN/SSM usage, endpoint security, session management |

**Sample Audit Procedures:**
- Select a sample of user accounts and verify access is appropriate for current role.
- Verify MFA is enabled on all required systems (AWS, GitHub, admin panel).
- Review privileged account inventory and confirm monthly reviews are occurring.
- Test password policy enforcement by attempting non-compliant passwords.
- Review AWS IAM Access Analyzer findings and remediation status.
- Verify offboarding process for recent departures (access revoked within SLA).

### 4.2 Q2: Data Handling and Encryption (April - June)

| Audit Area | ISO 27001 Reference | Key Controls to Audit |
|-----------|---------------------|----------------------|
| Data classification | A.5.12, A.5.13 | Classification accuracy, labeling compliance, handling per policy |
| Data encryption | A.8.24 | Encryption at rest (RDS, S3, EBS), encryption in transit (TLS), key management |
| Data retention and disposal | A.5.33 | Retention schedule compliance, disposal verification, automated lifecycle policies |
| Data transfer controls | A.5.14 | Secure transmission methods, API security, third-party data sharing |
| Privacy and GDPR compliance | A.5.34 | Consent management, data subject rights handling, privacy notices |
| Backup integrity | A.8.13 | Backup schedule adherence, restoration testing, cross-region replication |
| Database security | A.8.25 | RDS configuration, network isolation, query logging, access controls |

**Sample Audit Procedures:**
- Select a sample of data assets and verify correct classification.
- Verify S3 bucket encryption settings and public access blocks.
- Confirm RDS encryption at rest is enabled using customer-managed KMS keys.
- Test TLS configuration on all public endpoints (minimum TLS 1.2).
- Review data retention job execution logs and verify data past retention is deleted.
- Perform a test backup restoration and validate data integrity.
- Review customer deletion requests and verify compliance with SLA.

### 4.3 Q3: Infrastructure and Networking (July - September)

| Audit Area | ISO 27001 Reference | Key Controls to Audit |
|-----------|---------------------|----------------------|
| Network security | A.8.20, A.8.21, A.8.22 | VPC configuration, security groups, NACLs, network segmentation |
| Cloud infrastructure security | A.8.23 | ECS configuration, container security, image scanning |
| Vulnerability management | A.8.8 | Scanning frequency, remediation SLAs, patch management |
| Change management | A.8.32 | Change process compliance, approval records, post-implementation reviews |
| Logging and monitoring | A.8.15, A.8.16 | CloudWatch configuration, CloudTrail coverage, alerting effectiveness |
| CI/CD pipeline security | A.8.25, A.8.27 | Pipeline integrity, secrets management, SAST/DAST scanning |
| Terraform/IaC controls | A.8.9 | Infrastructure as code review, state file security, drift detection |

**Sample Audit Procedures:**
- Review VPC security group rules for overly permissive configurations.
- Verify no resources have unintended public internet exposure.
- Review ECR image scan results and verify critical findings are remediated.
- Select a sample of recent changes and verify change management process was followed.
- Verify CloudTrail is enabled in all regions with log integrity validation.
- Review CloudWatch alarms and confirm critical alerts are properly configured.
- Test that CI pipeline rejects code with critical security findings.
- Review Terraform state file access controls and backup procedures.

### 4.4 Q4: Incident Response and Business Continuity (October - December)

| Audit Area | ISO 27001 Reference | Key Controls to Audit |
|-----------|---------------------|----------------------|
| Incident response readiness | A.5.24, A.5.25, A.5.26 | IRP currency, team readiness, communication plan, escalation matrix |
| Incident response effectiveness | A.5.27, A.5.28 | Incident handling metrics (MTTD, MTTR), post-incident reviews, lessons learned |
| Business continuity | A.5.29, A.5.30 | BCP currency, RTO/RPO validation, DR testing results |
| Disaster recovery | A.5.30 | Backup restoration success, failover testing, runbook accuracy |
| Supplier management | A.5.19, A.5.20, A.5.21, A.5.22 | Assessment completion, contract compliance, monitoring effectiveness |
| Security awareness | A.6.3 | Training completion rates, phishing simulation results |
| ISMS management review | ISO 27001 9.3 | Management review meeting completion, action items tracking |
| Risk management | ISO 27001 6.1, 8.2, 8.3 | Risk register currency, treatment plan progress, risk reassessment |

**Sample Audit Procedures:**
- Verify IRP contact information is current and complete.
- Review incident records from the past year; verify classification and response times met SLA.
- Confirm post-incident reviews were completed for all P1/P2 incidents.
- Review DR test results and verify RTO/RPO targets were achieved.
- Verify quarterly BCP tabletop exercises were conducted.
- Check supplier assessment completion against the schedule.
- Verify security awareness training completion rates meet 100% target.
- Review management review minutes and confirm action items are tracked.

## 5. Audit Methodology

### 5.1 Audit Approach

Each audit engagement follows these phases:

```
Planning --> Fieldwork --> Analysis --> Reporting --> Follow-up
```

### 5.2 Phase 1: Planning

| Activity | Details |
|----------|---------|
| Scope definition | Define specific controls, processes, and systems to audit |
| Risk assessment | Identify high-risk areas to prioritize within the audit scope |
| Resource allocation | Assign auditor(s) with appropriate competency and independence |
| Audit plan | Document objectives, scope, criteria, timeline, and methods |
| Notification | Notify auditees at least 2 weeks before the audit |
| Document review | Review relevant policies, procedures, and previous audit findings |

### 5.3 Phase 2: Fieldwork

| Method | Description | When to Use |
|--------|-------------|-------------|
| Document review | Examine policies, procedures, records, logs, and configurations | All audits |
| Interviews | Structured conversations with process owners and operators | Process audits |
| Technical testing | Direct examination of system configurations and controls | Infrastructure and application audits |
| Observation | Observe processes and practices in operation | Process and operational audits |
| Sampling | Select representative samples of transactions, records, or events | When full population review is impractical |
| Walkthrough | Step through a process end-to-end to verify compliance | Complex processes |

### 5.4 Phase 3: Analysis

- Evaluate evidence against audit criteria (ISO 27001 requirements, Extrapl policies, industry best practices).
- Classify findings (see Section 7).
- Identify root causes for non-conformities.
- Develop recommendations proportionate to the risk.

### 5.5 Phase 4: Reporting

- Draft the audit report (see Section 8 for format).
- Review draft findings with auditees for factual accuracy.
- Finalize the report and distribute to stakeholders.
- Present findings to management.

### 5.6 Phase 5: Follow-up

- Track corrective action implementation.
- Verify corrective actions are effective.
- Escalate overdue actions to management.
- Include follow-up status in subsequent audit reports.

## 6. Auditor Competency Requirements

### 6.1 Qualification Criteria

| Requirement | Internal Auditors | Lead Auditor |
|-------------|------------------|-------------|
| ISO 27001 knowledge | Required (training or certification) | ISO 27001 Lead Auditor certification preferred |
| Audit experience | Minimum 1 audit as observer/assistant | Minimum 3 audits conducted |
| Technical knowledge | Relevant to audit scope | Broad understanding of information security domains |
| Independence | Must not audit their own work or area of responsibility | Must not audit their own work or area of responsibility |
| Objectivity | No conflicts of interest | No conflicts of interest |
| Confidentiality | Bound by confidentiality agreement | Bound by confidentiality agreement |

### 6.2 Independence and Objectivity

- Auditors shall not audit processes, controls, or systems for which they are responsible.
- Auditors shall declare any potential conflicts of interest before commencing an audit.
- Where internal independence is not achievable (small team), compensating measures shall be applied:
  - Cross-functional audit assignments.
  - External audit support for critical domains.
  - Management review of audit findings.
- Audit results shall not be influenced by auditee management.

### 6.3 Continuing Professional Development

- Internal auditors shall complete a minimum of [CPD_HOURS] hours of relevant training annually.
- Training topics may include ISO 27001 updates, audit techniques, cloud security, and emerging threats.
- Training records shall be maintained.

## 7. Finding Classification

### 7.1 Finding Categories

| Category | Definition | Response Required |
|----------|-----------|------------------|
| **Major Non-Conformity** | Complete absence of or significant failure in a required control. Directly threatens the ISMS or represents a systemic issue. Could result in a significant security incident. | Corrective action plan within **5 business days**. Resolution within **30 days**. Verification audit required. |
| **Minor Non-Conformity** | Partial implementation or isolated failure of a required control. Does not represent a systemic issue. Limited potential for security impact. | Corrective action plan within **10 business days**. Resolution within **60 days**. Verified in next scheduled audit. |
| **Observation** | An area that is currently conformant but shows signs of potential future non-conformity, or an area where improvement would enhance the ISMS. | Improvement plan recommended. Tracked for follow-up. No mandatory deadline. |
| **Opportunity for Improvement (OFI)** | A suggestion for enhancing the effectiveness or efficiency of a control or process beyond minimum compliance. | Considered during next review cycle. No mandatory action. |
| **Good Practice** | A control or process that exceeds requirements and serves as a model for other areas. | Recognized and shared as a positive example. |

### 7.2 Finding Documentation

Each finding shall be documented with:

- Finding ID (AUDIT-[YYYY]-Q[N]-[NNN])
- Audit engagement reference
- ISO 27001 clause or Annex A control reference
- Finding category
- Description of the finding (what was observed)
- Evidence supporting the finding
- Root cause analysis (for non-conformities)
- Risk implication
- Recommendation
- Corrective action plan (completed by auditee)
- Target resolution date
- Resolution status

## 8. Reporting Format

### 8.1 Audit Report Structure

Each quarterly audit shall produce a formal report containing:

1. **Executive Summary**: High-level overview of findings, conclusions, and risk posture.
2. **Audit Scope and Objectives**: What was audited and why.
3. **Methodology**: How the audit was conducted.
4. **Findings Summary**: Table of all findings by category.
5. **Detailed Findings**: Individual finding details (as per Section 7.2).
6. **Previous Audit Follow-up**: Status of open findings from previous audits.
7. **Conclusion and Opinion**: Overall assessment of ISMS conformity and effectiveness.
8. **Recommendations**: Prioritized list of improvement actions.
9. **Appendices**: Evidence references, interview lists, sampling methodology.

### 8.2 Report Distribution

| Recipient | Report Type | Timing |
|-----------|-----------|--------|
| CISO | Full report | Within 10 business days of audit completion |
| CEO / Executive Management | Executive summary | Within 15 business days of audit completion |
| Auditees / Process Owners | Relevant findings only | Within 10 business days of audit completion |
| External auditors (if applicable) | Full report (upon request) | As requested for certification audits |

### 8.3 Annual Audit Summary

At the end of each calendar year, an annual audit summary report shall be prepared covering:

- All audits conducted during the year.
- Summary of findings by category and trend analysis.
- Status of all open corrective actions.
- Assessment of ISMS maturity and improvement trajectory.
- Recommendations for the next year's audit program.
- Input for the management review meeting.

## 9. Corrective Action Tracking

### 9.1 Corrective Action Process

| Step | Action | Responsible | Timeline |
|------|--------|-------------|----------|
| 1 | Finding communicated to auditee | Lead Auditor | Within report |
| 2 | Root cause analysis completed | Auditee / Process Owner | Per finding category deadline |
| 3 | Corrective action plan submitted | Auditee / Process Owner | Per finding category deadline |
| 4 | Corrective action plan approved | CISO | Within 5 business days of submission |
| 5 | Corrective action implemented | Auditee / Process Owner | Per agreed timeline |
| 6 | Implementation verified | Lead Auditor or designated verifier | Within 10 business days of completion |
| 7 | Finding closed | Lead Auditor | Upon successful verification |

### 9.2 Escalation for Overdue Actions

| Overdue By | Escalation Target | Action |
|-----------|-------------------|--------|
| 15 days | CISO | Reminder and revised timeline request |
| 30 days | CTO / relevant executive | Management intervention; resource allocation |
| 60 days | CEO / Executive Management | Formal escalation; potential risk acceptance decision |

### 9.3 Corrective Action Metrics

| Metric | Target |
|--------|--------|
| Corrective action plans submitted within deadline | 100% |
| Major non-conformities resolved within 30 days | 100% |
| Minor non-conformities resolved within 60 days | > 90% |
| Corrective actions verified as effective | > 95% |
| Repeat findings (same issue in consecutive audits) | 0 |

## 10. Management Review Integration

The internal audit program provides key inputs to the ISMS management review (ISO 27001 Clause 9.3):

| Input | Provided By | Frequency |
|-------|-----------|-----------|
| Quarterly audit results | Lead Auditor | Quarterly |
| Open corrective action status | Lead Auditor | Quarterly |
| Annual audit summary and trend analysis | Lead Auditor | Annually |
| Audit program effectiveness assessment | CISO | Annually |
| Recommendations for next audit cycle | Lead Auditor | Annually |

## 11. External Audit Coordination

### 11.1 Certification Audit Support

The internal audit program supports ISO 27001 certification by:

- Ensuring full coverage of all clauses and applicable controls within the audit cycle.
- Resolving all major non-conformities before the external audit.
- Maintaining complete audit records and evidence.
- Providing historical audit reports to external auditors upon request.

### 11.2 External Audit Schedule

| Audit Type | Frequency | Purpose |
|-----------|-----------|---------|
| ISO 27001 Stage 1 (documentation review) | Initial certification | Verify ISMS documentation readiness |
| ISO 27001 Stage 2 (implementation audit) | Initial certification | Verify ISMS implementation and effectiveness |
| ISO 27001 Surveillance audit | Annual (Years 1 and 2) | Confirm continued conformity |
| ISO 27001 Recertification audit | Every 3 years | Full reassessment for recertification |
| SOC 2 Type II audit | Annual | Service organization controls assessment |

## 12. Program Review and Improvement

The audit program itself shall be reviewed annually to ensure:

- Audit scope adequately covers all ISMS areas.
- Audit frequency is appropriate based on risk and previous findings.
- Auditor competency is maintained and developed.
- Audit methods remain effective and efficient.
- Lessons learned from audits are incorporated into the program.

## 13. Related Documents

| Document | Document ID |
|----------|-------------|
| Information Security Policy | ISMS-POL-001 |
| Risk Assessment Methodology | ISMS-PROC-001 |
| Access Control Policy | ISMS-POL-002 |
| Incident Response Plan | ISMS-PLAN-001 |
| Business Continuity Plan | ISMS-PLAN-002 |
| Change Management Procedure | ISMS-PROC-002 |
| Data Classification Policy | ISMS-POL-003 |
| Data Retention Policy | ISMS-POL-004 |
| Supplier Management Policy | ISMS-POL-005 |

## 14. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [DATE] | [AUTHOR] | Initial release |

## 15. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CISO | [CISO_NAME] | | [DATE] |
| CEO | [CEO_NAME] | | [DATE] |
