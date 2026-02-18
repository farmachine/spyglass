# Incident Response Plan

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Document ID**  | ISMS-PLAN-001                              |
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

This Incident Response Plan defines the procedures for detecting, reporting, assessing, responding to, and recovering from information security incidents affecting Extrapl and its SaaS platform. It establishes a structured approach to minimize the impact of incidents and restore normal operations as quickly as possible.

This plan is aligned with ISO/IEC 27001:2022 Annex A, Controls A.5.24 through A.5.28, and supports the Extrapl Information Security Policy (ISMS-POL-001).

## 2. Scope

This plan applies to all information security events and incidents affecting:

- The Extrapl SaaS platform and supporting infrastructure (AWS ECS, RDS, S3, etc.).
- Customer data processed, stored, or transmitted by the platform.
- Internal systems, tools, and communication channels used by Extrapl.
- Third-party services integrated with the platform (Google Gemini API, AgentMail, Neon).
- All employees, contractors, and third parties who may detect or be involved in incidents.

## 3. Definitions

| Term | Definition |
|------|-----------|
| **Security Event** | An observable occurrence in a system or network that may indicate a potential security issue |
| **Security Incident** | A security event that has been assessed and confirmed as a breach or threat to information security policies, acceptable use, or standard security practices |
| **Incident Response Team (IRT)** | The designated team responsible for coordinating the response to security incidents |
| **Incident Commander (IC)** | The individual leading the response to a specific incident |
| **Root Cause** | The fundamental reason an incident occurred |
| **Indicator of Compromise (IoC)** | Evidence that a security breach has occurred |

## 4. Incident Classification

### 4.1 Priority Levels

| Priority | Severity | Description | Examples | Response Time | Update Frequency |
|----------|----------|-------------|----------|---------------|-----------------|
| **P1** | Critical | Complete system outage, active data breach, or ransomware attack affecting production systems or customer data | Active exploitation of customer data, complete platform outage, ransomware encryption in progress | **15 minutes** (initial response) | Every **30 minutes** |
| **P2** | High | Significant degradation of service, confirmed unauthorized access, or vulnerability under active exploitation | Partial platform outage, confirmed unauthorized access to internal systems, DDoS attack in progress | **1 hour** (initial response) | Every **2 hours** |
| **P3** | Medium | Limited impact incident, potential security breach under investigation, or non-critical system compromise | Suspicious login activity, malware detected on employee workstation, non-critical service disruption | **4 hours** (initial response) | Every **8 hours** |
| **P4** | Low | Minor security event, policy violation, or informational alert requiring investigation | Failed login attempts below threshold, phishing email reported (not clicked), minor policy non-compliance | **24 hours** (initial response) | Daily |

### 4.2 Incident Categories

| Category | Description | Typical Priority |
|----------|-------------|-----------------|
| Data Breach | Unauthorized access to, or disclosure of, customer or sensitive data | P1-P2 |
| Unauthorized Access | Confirmed unauthorized access to systems or accounts | P1-P2 |
| Malware/Ransomware | Detection of malicious software on any Extrapl system | P1-P2 |
| Denial of Service | Attack or event causing service unavailability | P1-P3 |
| Insider Threat | Malicious or negligent actions by an employee or contractor | P1-P3 |
| Vulnerability Exploitation | Active exploitation of a known or zero-day vulnerability | P1-P2 |
| Phishing/Social Engineering | Targeted attack against Extrapl employees | P2-P4 |
| Supply Chain Compromise | Security incident affecting a third-party supplier | P1-P3 |
| Configuration Error | Misconfiguration leading to security exposure | P2-P4 |
| Policy Violation | Non-compliance with security policies | P3-P4 |

## 5. Incident Response Team

### 5.1 Team Composition

| Role | Primary | Backup | Responsibilities |
|------|---------|--------|-----------------|
| **Incident Commander** | [CISO_NAME] | [BACKUP_IC] | Overall coordination, decision-making, external communication |
| **Technical Lead** | [TECH_LEAD] | [BACKUP_TECH] | Technical investigation, containment, eradication |
| **Infrastructure Lead** | [INFRA_LEAD] | [BACKUP_INFRA] | AWS infrastructure, network, and system response |
| **Application Lead** | [APP_LEAD] | [BACKUP_APP] | Application-level investigation and remediation |
| **Communications Lead** | [COMMS_LEAD] | [BACKUP_COMMS] | Internal and external communications, customer notification |
| **Legal Advisor** | [LEGAL_CONTACT] | [EXTERNAL_COUNSEL] | Legal guidance, regulatory notification requirements |
| **Executive Sponsor** | [CEO_NAME] | [COO_NAME] | Strategic decisions, resource allocation, board communication |

### 5.2 On-Call Schedule

- The IRT maintains a 24/7 on-call rotation for P1 and P2 incidents.
- On-call schedules are managed through [ONCALL_TOOL] and distributed to the team.
- On-call personnel must acknowledge alerts within 15 minutes.
- Escalation occurs automatically if acknowledgment is not received within the required timeframe.

## 6. Detection Procedures

### 6.1 Detection Sources

| Source | Description | Monitoring Tool |
|--------|-------------|-----------------|
| AWS CloudWatch | Infrastructure metrics, application logs, alarms | CloudWatch Alarms + CloudWatch Logs |
| AWS GuardDuty | Threat detection for AWS accounts and workloads | GuardDuty findings |
| AWS CloudTrail | API activity logging across AWS services | CloudTrail + Athena queries |
| Application Logs | Extrapl platform error and security logs | CloudWatch Logs / [SIEM_TOOL] |
| Vulnerability Scanners | Automated scanning of infrastructure and containers | Trivy, ECR scanning, Semgrep |
| Endpoint Detection | Employee workstation monitoring | [EDR_TOOL] |
| GitHub Security | Code scanning, secret scanning, Dependabot alerts | GitHub Advanced Security |
| User Reports | Employees and customers reporting suspicious activity | Email, Slack, support tickets |
| Third-Party Alerts | Notifications from suppliers about security events | Email, vendor dashboards |

### 6.2 Alerting Thresholds

| Alert | Condition | Priority |
|-------|-----------|----------|
| Platform unavailability | Health check failures > 3 consecutive | P1 |
| Elevated error rate | 5xx error rate > 5% for 5 minutes | P2 |
| Unauthorized API access | 401/403 responses > [THRESHOLD] per minute from single source | P3 |
| GuardDuty high severity | GuardDuty finding with severity >= 7 | P1 |
| GuardDuty medium severity | GuardDuty finding with severity 4-6 | P3 |
| Failed login spike | > [THRESHOLD] failed logins in 5 minutes | P3 |
| Database connection anomaly | Connection count > 2x normal baseline | P2 |
| Secret exposure | GitHub secret scanning alert | P1 |

## 7. Incident Response Phases

### 7.1 Phase 1: Identification

**Objective**: Determine whether a security event constitutes a security incident.

1. **Receive alert or report**: Acknowledge the security event from any detection source.
2. **Initial triage**: Assess the event to determine if it is a genuine security incident.
3. **Classify**: Assign a priority level (P1-P4) based on the classification matrix.
4. **Assign Incident Commander**: Designate an IC based on the priority and nature of the incident.
5. **Create incident record**: Document the incident in the incident management system with:
   - Incident ID (INC-[YYYY]-[NNN])
   - Date/time of detection
   - Detection source
   - Initial description
   - Priority classification
   - Assigned IC

### 7.2 Phase 2: Containment

**Objective**: Limit the scope and impact of the incident.

#### Short-Term Containment

| Action | Applicability | Authority |
|--------|--------------|-----------|
| Isolate compromised systems (security groups / NACLs) | Network-based attacks | Technical Lead |
| Disable compromised user accounts | Unauthorized access | IC / CISO |
| Block malicious IP addresses (WAF / NACLs) | External attacks | Technical Lead |
| Revoke compromised credentials / API keys | Credential compromise | IC |
| Enable enhanced logging on affected systems | All incidents | Technical Lead |
| Take forensic snapshots of affected systems | P1-P2 incidents | Technical Lead |

#### Long-Term Containment

| Action | Applicability | Authority |
|--------|--------------|-----------|
| Deploy temporary security patches | Vulnerability exploitation | Technical Lead + IC |
| Implement additional monitoring rules | All incidents | Technical Lead |
| Restrict service functionality if needed | P1-P2 incidents | IC + Executive Sponsor |
| Engage third-party incident response support | P1 incidents or as needed | CISO + Executive Sponsor |

### 7.3 Phase 3: Eradication

**Objective**: Remove the root cause and any artifacts of the incident.

1. Identify and document the root cause.
2. Remove malware, unauthorized accounts, or backdoors.
3. Patch vulnerabilities that were exploited.
4. Verify that all compromised systems are clean.
5. Update security controls to prevent recurrence.
6. Scan for indicators of compromise (IoCs) across the environment.

### 7.4 Phase 4: Recovery

**Objective**: Restore systems to normal operation and verify integrity.

1. Restore affected systems from clean backups or rebuild as necessary.
2. Bring systems back online in a controlled manner.
3. Implement enhanced monitoring during the recovery period.
4. Validate system integrity and data consistency.
5. Confirm that all users can access restored services.
6. Monitor for signs of re-compromise for a minimum of 72 hours post-recovery.

### 7.5 Phase 5: Post-Incident Review

**Objective**: Learn from the incident and improve the response process.

| Activity | Timeline | Responsible |
|----------|----------|-------------|
| Post-incident review meeting | Within 5 business days of incident closure | IC |
| Draft incident report | Within 10 business days of incident closure | IC + Technical Lead |
| Identify lessons learned and improvement actions | During post-incident review | IRT |
| Update runbooks and procedures | Within 20 business days | Technical Lead |
| Implement preventive controls | Per agreed timeline | System owners |
| Management briefing (P1-P2 only) | Within 5 business days | CISO |

## 8. Escalation Matrix

### 8.1 Internal Escalation

| Trigger | Escalation Target | Timeline |
|---------|-------------------|----------|
| P1 incident declared | CISO, CTO, CEO | Immediately |
| P2 incident declared | CISO, CTO | Within 1 hour |
| P1 not contained within 2 hours | CEO, external IR firm | 2 hours from declaration |
| P2 not contained within 8 hours | CEO | 8 hours from declaration |
| Customer data confirmed compromised | CEO, Legal, Communications Lead | Immediately upon confirmation |
| IC requires additional resources | CISO / Executive Sponsor | As needed |

### 8.2 External Escalation

| Trigger | External Party | Timeline | Responsible |
|---------|---------------|----------|-------------|
| Confirmed customer data breach | Affected customers | Per contractual and regulatory requirements (typically 72 hours) | Communications Lead + Legal |
| Regulatory notification required | Data protection authority (e.g., ICO, relevant DPA) | Within 72 hours of awareness (GDPR) | Legal + CISO |
| Law enforcement involvement needed | Appropriate law enforcement agency | As determined by Legal and CISO | Legal |
| Third-party involvement confirmed | Affected supplier(s) | Immediately upon identification | CISO |
| Insurance notification | Cyber insurance provider | Per policy requirements | Legal + Finance |

## 9. Communication Plan

### 9.1 Internal Communication

| Audience | Channel | Frequency | Content |
|----------|---------|-----------|---------|
| IRT Members | Dedicated Slack channel (#incident-[ID]) | Continuous during active incident | Technical updates, actions, decisions |
| Engineering Team | Slack (#engineering) | Per update frequency for priority level | Status updates, required actions |
| Executive Team | Direct message / email | Per escalation matrix | Impact summary, business decisions needed |
| All Employees | Email / all-hands | As appropriate | Awareness, any required actions |

### 9.2 External Communication

| Audience | Channel | Timing | Content | Approval Required |
|----------|---------|--------|---------|-------------------|
| Affected Customers | Email + status page | Per regulatory/contractual requirements | Nature of incident, impact, remediation steps, contact info | CEO + Legal |
| Regulators | Formal notification | Per regulatory requirements | As required by applicable regulations | Legal |
| Media | Press statement | Only if incident becomes public or requires disclosure | Approved statement only | CEO + Legal + Communications |
| Partners/Suppliers | Direct communication | When their systems or data are involved | Relevant incident details, required actions | CISO |

### 9.3 Communication Templates

Pre-approved communication templates are maintained for the following scenarios:

- Customer data breach notification
- Service disruption notification
- Regulatory breach notification
- Internal incident alert
- Post-incident customer communication
- Media holding statement

Templates are stored in [TEMPLATE_LOCATION] and must be reviewed and approved by Legal and Communications before use.

## 10. Evidence Preservation

### 10.1 Evidence Collection

All evidence shall be collected and preserved in accordance with the following guidelines:

| Evidence Type | Collection Method | Storage |
|---------------|-------------------|---------|
| System logs | Export from CloudWatch, CloudTrail, application logs | Dedicated forensics S3 bucket (write-once) |
| Network captures | VPC Flow Logs, packet captures if applicable | Dedicated forensics S3 bucket |
| Disk images | EBS snapshots of affected instances | Separate AWS account (forensics) |
| Memory dumps | Live memory acquisition (if applicable) | Encrypted forensics storage |
| Access logs | IAM, application authentication logs | Dedicated forensics S3 bucket |
| Screenshots | Screenshots of relevant console/UI evidence | Incident record attachments |
| Communication records | Incident channel exports, emails | Incident record attachments |

### 10.2 Chain of Custody

- All evidence shall be labeled with: incident ID, date/time collected, collector name, description.
- A chain of custody log shall be maintained for each piece of evidence.
- Evidence shall be stored in a secure, access-controlled location with integrity verification (checksums).
- Evidence shall be retained for a minimum of [EVIDENCE_RETENTION_PERIOD] or as required by legal proceedings.
- Only authorized members of the IRT may access incident evidence.

### 10.3 Forensic Analysis

- Forensic analysis shall be performed on copies of evidence, never on original evidence.
- If internal forensic capabilities are insufficient, a pre-approved external forensics firm shall be engaged.
- All forensic findings shall be documented in the incident report.

## 11. Post-Incident Review

### 11.1 Review Process

A post-incident review (blameless retrospective) shall be conducted for all P1 and P2 incidents, and optionally for P3 incidents at the IC's discretion.

The review shall cover:

1. **Timeline**: Detailed chronological account of the incident.
2. **Root Cause Analysis**: Identification of the fundamental cause(s).
3. **Detection Effectiveness**: How the incident was detected and time to detection.
4. **Response Effectiveness**: How well the response plan was executed.
5. **Impact Assessment**: Final determination of the incident's impact.
6. **Lessons Learned**: What worked well and what could be improved.
7. **Action Items**: Specific, assigned, time-bound improvement actions.

### 11.2 Incident Report Template

All P1 and P2 incidents shall produce a formal incident report containing:

- Incident ID and classification
- Executive summary
- Detailed timeline
- Root cause analysis
- Systems and data affected
- Customer and business impact
- Response actions taken
- Evidence collected
- Lessons learned
- Remediation and improvement actions with owners and deadlines

### 11.3 Metrics and KPIs

The following metrics shall be tracked and reported quarterly:

| Metric | Target |
|--------|--------|
| Mean Time to Detect (MTTD) | < [TARGET] hours |
| Mean Time to Respond (MTTR) | < [TARGET] hours |
| Mean Time to Contain (MTTC) | < [TARGET] hours |
| Mean Time to Recover | < [TARGET] hours |
| Number of incidents by priority | Trending downward |
| Post-incident review completion rate | 100% for P1/P2 |
| Action item completion rate | > 90% within deadline |

## 12. Training and Testing

### 12.1 Training Requirements

| Audience | Training | Frequency |
|----------|----------|-----------|
| All employees | Security awareness and incident reporting | Annually |
| IRT members | Incident response procedures and tools | Semi-annually |
| Incident Commanders | IC leadership and decision-making | Annually |
| Technical team | Forensic analysis and containment techniques | Annually |

### 12.2 Testing and Exercises

| Exercise Type | Frequency | Scope |
|---------------|-----------|-------|
| Tabletop exercise | Semi-annually | IRT + Executive team; walk through P1 scenarios |
| Technical simulation | Annually | IRT; simulated attack/breach in test environment |
| Communication drill | Annually | Test escalation and notification processes |
| Full-scale exercise | Every 2 years | End-to-end incident response including external parties |

## 13. Related Documents

| Document | Document ID |
|----------|-------------|
| Information Security Policy | ISMS-POL-001 |
| Risk Assessment Methodology | ISMS-PROC-001 |
| Business Continuity Plan | ISMS-PLAN-002 |
| Access Control Policy | ISMS-POL-002 |
| Data Classification Policy | ISMS-POL-003 |

## 14. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [DATE] | [AUTHOR] | Initial release |

## 15. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CISO | [CISO_NAME] | | [DATE] |
| CEO | [CEO_NAME] | | [DATE] |
