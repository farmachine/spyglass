# Risk Assessment Methodology

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Document ID**  | ISMS-PROC-001                              |
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

This document defines the methodology used by Extrapl to identify, analyze, evaluate, and treat information security risks. It establishes a consistent and repeatable approach to risk management aligned with ISO/IEC 27001:2022 (Clauses 6.1.2, 8.2, and 8.3) and ISO/IEC 27005.

## 2. Scope

This methodology applies to all information assets, systems, processes, and services within the scope of the Extrapl ISMS, including:

- The Extrapl SaaS platform and its supporting infrastructure (AWS).
- Customer data processed and stored by the platform.
- Internal systems and tools used by Extrapl personnel.
- Third-party services and integrations (e.g., Google Gemini API, AgentMail, Neon).
- Physical and environmental controls (where applicable).

## 3. Risk Management Framework

### 3.1 Overview

The risk management process follows these phases:

```
Risk Identification --> Risk Analysis --> Risk Evaluation --> Risk Treatment --> Risk Monitoring
       ^                                                                            |
       |____________________________________________________________________________|
```

### 3.2 Roles in Risk Management

| Role | Responsibility |
|------|---------------|
| CISO | Owns the risk management process; maintains the risk register; reports to management |
| Risk Owners | Accept accountability for specific risks; approve treatment plans |
| Executive Management | Define risk appetite; approve risk treatment decisions above threshold |
| Department Managers | Identify risks within their areas; implement treatment plans |
| All Staff | Report potential risks, threats, and vulnerabilities |

## 4. Risk Identification

### 4.1 Asset Identification

All information assets within the ISMS scope shall be identified and documented in the Asset Register. Assets are categorized as:

| Asset Category | Examples |
|---------------|----------|
| Information | Customer data, user credentials, API keys, business data, logs |
| Software | Extrapl platform code, dependencies, AI models, internal tools |
| Infrastructure | AWS ECS clusters, RDS instances, S3 buckets, VPCs, load balancers |
| Services | Google Gemini API, AgentMail, Neon database, CI/CD pipelines |
| People | Employees, contractors, administrators |
| Physical | Office equipment, workstations (if applicable) |

### 4.2 Threat Identification

Threats shall be identified by considering:

- Historical incident data (internal and industry).
- Threat intelligence sources and advisories.
- Changes in the technology landscape.
- Regulatory and legal changes.
- Results of vulnerability assessments and penetration tests.
- Industry-specific threat reports (SaaS, AI/ML, cloud computing).

### 4.3 Vulnerability Identification

Vulnerabilities shall be identified through:

- Automated vulnerability scanning (infrastructure and application).
- Penetration testing (at least annually).
- Code reviews and static analysis.
- Configuration audits.
- Architecture reviews.
- Supplier security assessments.

### 4.4 Risk Scenarios

Each identified risk shall be documented as a risk scenario using the following format:

> **Risk ID**: RISK-[YYYY]-[NNN]
> **Threat**: [Description of the threat]
> **Vulnerability**: [Description of the vulnerability exploited]
> **Asset(s) Affected**: [Information asset(s) impacted]
> **Risk Owner**: [Name and role]
> **Existing Controls**: [Current mitigations in place]
> **Date Identified**: [Date]

## 5. Risk Analysis

### 5.1 Approach

Extrapl uses a semi-quantitative risk analysis approach. Each risk is assessed based on two factors:

- **Likelihood**: The probability that the risk scenario will materialize.
- **Impact**: The consequence to Extrapl if the risk scenario materializes.

### 5.2 Likelihood Criteria

| Level | Rating | Description | Frequency Indicator |
|-------|--------|-------------|---------------------|
| 1 | Rare | The event is unlikely to occur; no history of occurrence | Less than once in 5 years |
| 2 | Unlikely | The event could occur but is not expected | Once in 2-5 years |
| 3 | Possible | The event may occur at some time | Once per year |
| 4 | Likely | The event will probably occur in most circumstances | Multiple times per year |
| 5 | Almost Certain | The event is expected to occur; history of regular occurrence | Monthly or more frequently |

### 5.3 Impact Criteria

| Level | Rating | Confidentiality | Integrity | Availability | Financial | Reputational | Legal/Regulatory |
|-------|--------|----------------|-----------|--------------|-----------|-------------|-----------------|
| 1 | Negligible | Exposure of non-sensitive internal data | Minor data quality issue, quickly corrected | < 1 hour downtime, no customer impact | < $[AMOUNT_1] | No external awareness | No regulatory interest |
| 2 | Minor | Exposure of internal data to limited audience | Data error affecting small number of records | 1-4 hours downtime, minimal customer impact | $[AMOUNT_1] - $[AMOUNT_2] | Limited local media | Regulatory inquiry possible |
| 3 | Moderate | Exposure of confidential data, limited scope | Significant data corruption, partial recovery possible | 4-24 hours downtime, moderate customer impact | $[AMOUNT_2] - $[AMOUNT_3] | Industry media coverage | Regulatory investigation |
| 4 | Major | Exposure of restricted data, large scale | Widespread data corruption, recovery difficult | 1-7 days downtime, significant customer impact | $[AMOUNT_3] - $[AMOUNT_4] | National media coverage | Regulatory enforcement action |
| 5 | Critical | Mass exposure of restricted/customer PII | Unrecoverable data loss | > 7 days downtime, critical customer impact | > $[AMOUNT_4] | Sustained negative media | Significant fines, legal action |

**Note**: The highest applicable impact across all categories determines the overall impact rating.

### 5.4 Risk Rating Matrix

The risk rating is calculated as: **Risk Rating = Likelihood x Impact**

|  | **Negligible (1)** | **Minor (2)** | **Moderate (3)** | **Major (4)** | **Critical (5)** |
|---|---|---|---|---|---|
| **Almost Certain (5)** | Medium (5) | High (10) | High (15) | Critical (20) | Critical (25) |
| **Likely (4)** | Low (4) | Medium (8) | High (12) | Critical (16) | Critical (20) |
| **Possible (3)** | Low (3) | Medium (6) | Medium (9) | High (12) | Critical (15) |
| **Unlikely (2)** | Low (2) | Low (4) | Medium (6) | Medium (8) | High (10) |
| **Rare (1)** | Low (1) | Low (2) | Low (3) | Low (4) | Medium (5) |

### 5.5 Risk Rating Levels

| Risk Rating | Score Range | Description |
|-------------|------------|-------------|
| **Critical** | 15-25 | Unacceptable risk requiring immediate action |
| **High** | 10-14 | Significant risk requiring prompt treatment |
| **Medium** | 5-9 | Moderate risk requiring planned treatment |
| **Low** | 1-4 | Acceptable risk; monitor and review |

## 6. Risk Evaluation

### 6.1 Risk Evaluation Criteria

Evaluated risks are compared against the organization's risk appetite to determine whether risk treatment is required:

| Risk Rating | Treatment Requirement | Approval Authority |
|-------------|----------------------|-------------------|
| **Critical** | Mandatory and immediate treatment required. Must be escalated to executive management within 24 hours. | CEO / Executive Management |
| **High** | Treatment required within [HIGH_RISK_TIMELINE] days. | CISO |
| **Medium** | Treatment plan required within [MEDIUM_RISK_TIMELINE] days. May be accepted with documented justification. | CISO / Risk Owner |
| **Low** | Accepted by default. Monitored during regular risk reviews. | Risk Owner |

### 6.2 Risk Prioritization

When multiple risks require treatment, they shall be prioritized based on:

1. Risk rating (highest first).
2. Number and sensitivity of assets affected.
3. Regulatory or contractual implications.
4. Cost-effectiveness of available treatment options.
5. Dependencies with other risks.

## 7. Risk Treatment

### 7.1 Treatment Options

For each risk requiring treatment, one or more of the following options shall be selected:

| Option | Description | When to Apply |
|--------|-------------|---------------|
| **Mitigate** | Implement controls to reduce likelihood and/or impact | When cost-effective controls exist |
| **Transfer** | Share the risk with a third party (e.g., insurance, outsourcing) | When external parties can better manage the risk |
| **Avoid** | Eliminate the risk by removing the source or ceasing the activity | When the risk outweighs the benefit of the activity |
| **Accept** | Acknowledge the risk without additional treatment | When the risk is within appetite and treatment is not cost-effective |

### 7.2 Risk Treatment Plan

Each risk treatment shall be documented in a Risk Treatment Plan containing:

| Field | Description |
|-------|-------------|
| Risk ID | Reference to the risk in the risk register |
| Treatment Option | Mitigate, Transfer, Avoid, or Accept |
| Proposed Controls | Specific controls to be implemented |
| Responsible Person | Individual accountable for implementation |
| Timeline | Target completion date |
| Resources Required | Budget, personnel, tools |
| Expected Residual Risk | Anticipated risk level after treatment |
| Acceptance Criteria | Conditions for considering the treatment successful |

### 7.3 Residual Risk

After treatment, the residual risk shall be re-evaluated using the same criteria. If the residual risk remains above the organization's risk appetite, additional treatment is required or formal risk acceptance must be obtained from executive management.

### 7.4 Statement of Applicability (SoA)

The Statement of Applicability shall document:

- All controls from ISO 27001:2022 Annex A.
- Justification for inclusion or exclusion of each control.
- Implementation status of each included control.
- Reference to implementing documents or procedures.

## 8. Risk Appetite Statement

### 8.1 Risk Appetite

Extrapl's risk appetite is defined as follows:

- **Critical risks**: Zero tolerance. All critical risks must be treated to reduce them to High or below.
- **High risks**: Low tolerance. High risks must be treated to Medium or below within the defined timeline.
- **Medium risks**: Moderate tolerance. Medium risks may be accepted with documented justification and ongoing monitoring.
- **Low risks**: Accepted. Low risks are accepted and monitored during regular reviews.

### 8.2 Specific Risk Appetite Statements

| Risk Domain | Appetite | Statement |
|-------------|----------|-----------|
| Customer Data Breach | Very Low | Near-zero tolerance for unauthorized access to or exposure of customer data |
| Platform Availability | Low | Service availability must meet SLA commitments of [SLA_PERCENTAGE]% uptime |
| Regulatory Non-Compliance | Very Low | Zero tolerance for known regulatory non-compliance |
| Financial Loss | Moderate | Acceptable financial risk up to $[AMOUNT] per incident |
| Reputational Harm | Low | Low tolerance for events causing negative customer perception |
| Third-Party Risk | Moderate | Acceptable where contractual and technical controls are in place |

## 9. Risk Register

The Risk Register is the central repository for all identified risks and is maintained by the CISO. It shall contain, at minimum:

- Risk ID
- Risk description (threat, vulnerability, asset)
- Risk owner
- Likelihood and impact ratings
- Current risk rating
- Existing controls
- Treatment decision and plan
- Residual risk rating
- Status and review date

The Risk Register shall be stored in [RISK_REGISTER_LOCATION] and access shall be restricted to authorized personnel.

## 10. Risk Monitoring and Review

### 10.1 Review Frequency

| Activity | Frequency | Responsible |
|----------|-----------|-------------|
| Full risk assessment | Annually | CISO |
| Risk register review | Quarterly | CISO + Risk Owners |
| Treatment plan progress review | Monthly | CISO |
| Management review of risk posture | Bi-annually | Executive Management |
| Trigger-based reassessment | As needed | CISO |

### 10.2 Triggers for Reassessment

The risk assessment shall be updated (in whole or in part) when:

- A significant security incident occurs.
- Major changes to the platform, infrastructure, or architecture are planned.
- New services, integrations, or third-party relationships are established.
- Regulatory or legal requirements change.
- Vulnerability scans or penetration tests reveal significant findings.
- Organizational changes occur (e.g., mergers, new business lines).

### 10.3 Key Risk Indicators (KRIs)

The following KRIs shall be monitored to provide early warning of changing risk levels:

| KRI | Threshold | Monitoring Frequency |
|-----|-----------|---------------------|
| Number of critical/high vulnerabilities | > [THRESHOLD] unresolved | Weekly |
| Failed login attempts | > [THRESHOLD] per day | Daily |
| Security incidents | > [THRESHOLD] per month | Monthly |
| Overdue risk treatment actions | > [THRESHOLD] | Monthly |
| Third-party security findings | Any critical findings | As identified |

## 11. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [DATE] | [AUTHOR] | Initial release |

## 12. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CISO | [CISO_NAME] | | [DATE] |
| CEO | [CEO_NAME] | | [DATE] |
