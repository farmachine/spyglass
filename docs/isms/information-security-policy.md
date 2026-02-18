# Information Security Policy

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Document ID**  | ISMS-POL-001                               |
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

This Information Security Policy establishes the framework for managing information security across Extrapl and its SaaS platform. It defines the principles, responsibilities, and requirements for protecting the confidentiality, integrity, and availability of information assets.

This policy serves as the top-level directive for the Extrapl Information Security Management System (ISMS) and is aligned with ISO/IEC 27001:2022.

## 2. Scope

This policy applies to:

- **People**: All employees, contractors, consultants, temporary staff, and third parties who access Extrapl information assets or systems.
- **Systems**: All information systems, applications, infrastructure, and services operated by or on behalf of Extrapl, including the Extrapl SaaS platform, internal tools, and supporting infrastructure hosted on AWS.
- **Information**: All information created, received, maintained, or transmitted by Extrapl, regardless of format (digital, paper, verbal).
- **Locations**: All locations from which Extrapl systems are accessed, including offices, remote work locations, and data centers.

### 2.1 Out of Scope

[Identify any exclusions from the ISMS scope and provide justification.]

## 3. Policy Statement

Extrapl is committed to protecting the information assets of the organization and its customers. The management of Extrapl recognizes the importance of information security and is committed to:

1. Protecting the confidentiality, integrity, and availability of all information assets.
2. Meeting all applicable legal, regulatory, and contractual requirements related to information security.
3. Continuously improving the effectiveness of the ISMS.
4. Ensuring that information security risks are identified, assessed, and treated to an acceptable level.
5. Providing the resources necessary to implement and maintain the ISMS.
6. Ensuring that all personnel understand their information security responsibilities through awareness, education, and training.
7. Preventing and detecting security incidents and minimizing their impact.

## 4. Information Security Objectives

Extrapl establishes the following measurable information security objectives, which are reviewed annually:

| Objective | Metric | Target | Measurement Frequency |
|-----------|--------|--------|-----------------------|
| Minimize security incidents | Number of P1/P2 incidents | < [TARGET_NUMBER] per year | Monthly |
| Maintain system availability | Platform uptime percentage | >= [TARGET_UPTIME]% | Monthly |
| Ensure timely vulnerability remediation | Critical vulnerability remediation time | < [TARGET_DAYS] days | Monthly |
| Security awareness | Training completion rate | 100% of staff annually | Quarterly |
| Access control compliance | Percentage of access reviews completed on time | 100% | Quarterly |
| Incident response readiness | Mean time to detect (MTTD) | < [TARGET_HOURS] hours | Per incident |
| Incident response effectiveness | Mean time to respond (MTTR) | < [TARGET_HOURS] hours | Per incident |
| Third-party risk | Percentage of critical suppliers assessed | 100% | Annually |

## 5. Roles and Responsibilities

### 5.1 Executive Management

- Demonstrate leadership and commitment to the ISMS.
- Approve the Information Security Policy and ISMS scope.
- Allocate adequate resources for information security.
- Participate in management review meetings.
- Establish the organization's risk appetite.

### 5.2 Chief Information Security Officer (CISO)

The CISO ([CISO_NAME]) is responsible for:

- Overseeing the development, implementation, and maintenance of the ISMS.
- Reporting on ISMS performance to executive management.
- Coordinating risk assessments and treatment activities.
- Managing the security incident response process.
- Ensuring compliance with applicable laws, regulations, and contractual obligations.
- Conducting or coordinating internal audits of the ISMS.
- Leading security awareness and training programs.
- Managing relationships with external security stakeholders and auditors.

### 5.3 Information Security Team

- Implement and operate security controls.
- Monitor security events and respond to incidents.
- Conduct vulnerability assessments and penetration testing.
- Manage access control and identity management.
- Maintain security documentation and procedures.

### 5.4 Department Managers

- Ensure compliance with information security policies within their departments.
- Identify and report information security risks relevant to their areas.
- Ensure that staff complete required security awareness training.
- Authorize and review access rights for their team members.
- Report security incidents and near-misses.

### 5.5 All Employees and Contractors

- Comply with all information security policies, procedures, and standards.
- Protect information assets in their custody.
- Report security incidents, vulnerabilities, and suspected breaches immediately.
- Complete required security awareness training.
- Use information systems only for authorized purposes.
- Protect authentication credentials and not share them.

### 5.6 Data Protection Officer (DPO)

[DPO_NAME] (if applicable) is responsible for:

- Advising on data protection obligations.
- Monitoring compliance with data protection regulations (e.g., GDPR).
- Serving as a point of contact for data subjects and supervisory authorities.

## 6. Information Security Principles

The following principles underpin all information security activities at Extrapl:

1. **Defense in Depth**: Multiple layers of security controls are implemented to protect information assets.
2. **Least Privilege**: Access to information and systems is granted on a need-to-know and need-to-use basis.
3. **Separation of Duties**: Critical functions are divided among different individuals to reduce the risk of fraud or error.
4. **Security by Design**: Security is considered from the earliest stages of system and process design.
5. **Continuous Improvement**: The ISMS is continually monitored, reviewed, and improved.
6. **Risk-Based Approach**: Security investments and controls are proportionate to the risks they address.

## 7. Policy Framework

This Information Security Policy is supported by the following subordinate policies and procedures:

| Document | Document ID | Description |
|----------|-------------|-------------|
| Risk Assessment Methodology | ISMS-PROC-001 | Defines the approach to identifying, analyzing, and evaluating risks |
| Access Control Policy | ISMS-POL-002 | Controls for managing user access to systems and data |
| Incident Response Plan | ISMS-PLAN-001 | Procedures for detecting, responding to, and recovering from incidents |
| Business Continuity Plan | ISMS-PLAN-002 | Procedures for maintaining operations during disruptions |
| Change Management Procedure | ISMS-PROC-002 | Controls for managing changes to systems and infrastructure |
| Data Classification Policy | ISMS-POL-003 | Framework for classifying and handling information |
| Data Retention Policy | ISMS-POL-004 | Requirements for retaining and disposing of data |
| Supplier Management Policy | ISMS-POL-005 | Controls for managing third-party risks |
| Internal Audit Program | ISMS-PROG-001 | Framework for auditing the ISMS |

## 8. Compliance

### 8.1 Legal and Regulatory Requirements

Extrapl shall comply with all applicable legal, regulatory, and contractual requirements, including but not limited to:

- **ISO/IEC 27001:2022**: Information Security Management System standard.
- **General Data Protection Regulation (GDPR)**: Where processing EU/EEA personal data.
- **California Consumer Privacy Act (CCPA)**: Where processing California residents' personal data.
- **SOC 2 Type II**: Service organization controls for security, availability, and confidentiality.
- [OTHER_APPLICABLE_REGULATIONS]: [DESCRIPTION].

### 8.2 Contractual Requirements

Information security requirements specified in customer contracts, service level agreements, and third-party agreements shall be identified, documented, and fulfilled.

### 8.3 Policy Compliance

- Compliance with this policy is mandatory for all personnel within scope.
- Violations may result in disciplinary action, up to and including termination of employment or contract.
- Suspected violations shall be reported to the CISO or through the designated reporting channels.

## 9. Risk Management

Information security risks are managed through a formal risk assessment process as defined in the Risk Assessment Methodology (ISMS-PROC-001). Key elements include:

- Risks are identified, analyzed, and evaluated at least annually and whenever significant changes occur.
- Risk treatment decisions are documented and approved by risk owners.
- A risk register is maintained and reviewed by management.
- The organization's risk appetite is defined and communicated by executive management.

## 10. Security Awareness and Training

- All employees and contractors shall complete information security awareness training upon onboarding and annually thereafter.
- Role-specific training shall be provided to personnel with specialized security responsibilities.
- Training effectiveness shall be measured and reported.
- Phishing simulations and other awareness exercises shall be conducted regularly.

## 11. Policy Review

- This policy shall be reviewed at least annually, or whenever significant changes occur that may affect the ISMS (e.g., organizational changes, new regulations, major incidents).
- The CISO is responsible for initiating and coordinating the review.
- Changes to this policy require approval from [APPROVER_ROLE].
- All personnel shall be notified of material changes to this policy.

| Review Cycle | Frequency | Next Review Date |
|-------------|-----------|-----------------|
| Scheduled Review | Annual | [NEXT_REVIEW_DATE] |
| Trigger-Based Review | As needed | N/A |

## 12. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [DATE] | [AUTHOR] | Initial release |

## 13. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CISO | [CISO_NAME] | | [DATE] |
| CEO | [CEO_NAME] | | [DATE] |
| [ADDITIONAL_APPROVER] | [NAME] | | [DATE] |
