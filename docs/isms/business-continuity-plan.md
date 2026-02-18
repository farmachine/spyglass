# Business Continuity Plan

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Document ID**  | ISMS-PLAN-002                              |
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

This Business Continuity Plan (BCP) defines the procedures and strategies for maintaining and restoring critical business operations and IT services in the event of a disruption affecting Extrapl and its SaaS platform. The plan ensures that essential functions continue with minimal downtime and data loss.

This plan is aligned with ISO/IEC 27001:2022 Annex A, Controls A.5.29 and A.5.30, and supports the Extrapl Information Security Policy (ISMS-POL-001).

## 2. Scope

This plan covers:

- The Extrapl SaaS platform and all supporting services.
- AWS infrastructure (ECS, RDS, S3, VPC, Route 53, ALB, CloudFront).
- Third-party service dependencies (Google Gemini API, AgentMail, Neon).
- Internal tools and communication systems.
- Key personnel and their roles during a disruption.

### 2.1 Out of Scope

- Physical office continuity (Extrapl operates as a remote-first organization).
- Non-critical internal tooling that does not affect platform availability.

## 3. Business Impact Analysis

### 3.1 Critical Business Functions

| Function | Description | Maximum Tolerable Downtime | Priority |
|----------|-------------|---------------------------|----------|
| Extrapl SaaS Platform | Customer-facing web application and API | 15 minutes | Critical |
| Data Extraction Processing | AI-powered data extraction services | 1 hour | High |
| Customer Data Storage | RDS database containing customer data and extraction results | 4 hours | Critical |
| File Storage (S3) | Customer uploaded documents and extracted data files | 4 hours | High |
| User Authentication | Login and session management | 15 minutes | Critical |
| Billing and Subscriptions | Payment processing and subscription management | 8 hours | Medium |
| Internal Communications | Slack, email, internal tooling | 24 hours | Low |

### 3.2 Recovery Objectives

| System / Service | RPO (Recovery Point Objective) | RTO (Recovery Time Objective) | Recovery Strategy |
|------------------|-------------------------------|-------------------------------|-------------------|
| **Extrapl Application (ECS)** | 0 (stateless) | 15 minutes | ECS auto-scaling, multi-AZ deployment, automated health checks and task replacement |
| **RDS Database (PostgreSQL)** | 1 hour | 4 hours | Multi-AZ deployment with automatic failover, automated backups with point-in-time recovery |
| **S3 File Storage** | 0 (durability: 99.999999999%) | 15 minutes | Cross-region replication, versioning enabled |
| **Application Load Balancer** | N/A | 5 minutes | AWS managed, multi-AZ by default |
| **DNS (Route 53)** | N/A | 5 minutes | AWS managed, 100% SLA, health-check based routing |
| **Secrets / Configuration** | 0 | 15 minutes | AWS Secrets Manager with cross-region replication |
| **CI/CD Pipeline** | 0 (code in Git) | 1 hour | GitHub Actions; infrastructure as code enables rebuild |

### 3.3 Dependency Map

```
Customer Request
    |
    v
Route 53 (DNS) --> CloudFront/ALB --> ECS (Application)
                                          |
                    +-----------+---------+---------+
                    |           |         |         |
                    v           v         v         v
                  RDS        S3       Gemini    AgentMail
               (Database)  (Files)   (AI API)   (Email)
                    |
                    v
               Neon (Legacy - being migrated)
```

## 4. AWS Recovery Strategies

### 4.1 Multi-AZ RDS (PostgreSQL)

| Feature | Configuration |
|---------|--------------|
| Deployment | Multi-AZ with synchronous standby replica |
| Automatic failover | Enabled; failover typically completes within 60-120 seconds |
| Automated backups | Enabled with [BACKUP_RETENTION_DAYS]-day retention |
| Point-in-time recovery | Available for any point within the backup retention period |
| Manual snapshots | Taken before major deployments and retained per retention policy |
| Read replicas | Available for scaling read operations and as additional recovery source |
| Cross-region backup | Automated backup replication to [DR_REGION] |

**Recovery Procedures:**

1. **Automatic failover (AZ failure)**: RDS automatically promotes the standby; application reconnects via the existing endpoint. No manual intervention required.
2. **Point-in-time recovery**: Restore to a new RDS instance from the closest available recovery point. Update application configuration to point to the new instance.
3. **Cross-region recovery**: In the event of a full region failure, restore from cross-region backup copy in [DR_REGION].

### 4.2 ECS Auto-Scaling and Recovery

| Feature | Configuration |
|---------|--------------|
| Deployment | Multi-AZ ECS Fargate tasks |
| Desired count | Minimum [MIN_TASKS] tasks across availability zones |
| Auto-scaling | Target tracking on CPU and memory utilization |
| Health checks | ALB health checks + container health checks (30s interval) |
| Task replacement | Unhealthy tasks automatically replaced by ECS service scheduler |
| Rolling deployment | New deployments use rolling updates with minimum healthy percentage |
| Circuit breaker | ECS deployment circuit breaker enabled to auto-rollback failed deployments |

**Recovery Procedures:**

1. **Single task failure**: ECS automatically launches a replacement task. No manual intervention.
2. **AZ failure**: ECS redistributes tasks across remaining AZs. ALB routes traffic accordingly.
3. **Deployment failure**: ECS deployment circuit breaker triggers automatic rollback.
4. **Full cluster recovery**: Redeploy using Terraform and latest Docker image from ECR.

### 4.3 S3 Recovery

| Feature | Configuration |
|---------|--------------|
| Durability | 99.999999999% (11 nines) |
| Versioning | Enabled on all buckets |
| Cross-region replication | Enabled to [DR_REGION] for critical buckets |
| Lifecycle policies | Transition to lower-cost storage classes per retention policy |
| Object Lock | Enabled for audit and compliance data (WORM) |

### 4.4 Network and DNS Recovery

| Component | Recovery Strategy |
|-----------|-------------------|
| Route 53 | Globally distributed; health-check based failover routing to DR region |
| CloudFront | Edge-cached content remains available during origin failures |
| ALB | Multi-AZ; automatically redistributes traffic on AZ failure |
| VPC | Infrastructure as code; can be rebuilt in alternate region via Terraform |

## 5. Backup Strategy

### 5.1 Backup Schedule

| Data Type | Backup Method | Frequency | Retention | Storage Location |
|-----------|--------------|-----------|-----------|-----------------|
| RDS database | Automated snapshots | Daily | [BACKUP_RETENTION_DAYS] days | Primary region + [DR_REGION] |
| RDS database | Continuous (point-in-time) | Continuous | [BACKUP_RETENTION_DAYS] days | Primary region |
| S3 objects | Cross-region replication | Continuous | Per object lifecycle | [DR_REGION] |
| ECS task definitions | Version controlled | Per deployment | Indefinite (in ECR) | ECR (primary region) |
| Terraform state | S3 backend with versioning | Per apply | Indefinite (versioned) | Primary region + [DR_REGION] |
| Application code | Git (GitHub) | Per commit | Indefinite | GitHub (multi-region) |
| Secrets and configuration | AWS Secrets Manager | Per change | Per rotation policy | Primary region + [DR_REGION] |
| Audit logs | CloudWatch Logs | Continuous | 1 year | Primary region |

### 5.2 Backup Verification

| Verification Activity | Frequency | Responsible |
|----------------------|-----------|-------------|
| RDS backup restoration test | Quarterly | Infrastructure Lead |
| S3 data integrity check | Monthly | Infrastructure Lead |
| Full disaster recovery test | Quarterly | CISO + Infrastructure Lead |
| Terraform state validation | Monthly | Infrastructure Lead |
| Backup monitoring alerts | Continuous (automated) | CloudWatch Alarms |

## 6. Disaster Recovery Scenarios

### 6.1 Scenario 1: Single ECS Task Failure

| Attribute | Details |
|-----------|---------|
| Impact | Minimal; other tasks handle traffic |
| Detection | ALB health check failure |
| Recovery | Automatic; ECS replaces the task within 2-3 minutes |
| Manual action | None required |
| RTO | < 3 minutes |

### 6.2 Scenario 2: Single Availability Zone Failure

| Attribute | Details |
|-----------|---------|
| Impact | Temporary capacity reduction |
| Detection | CloudWatch alarms, ECS task count drop |
| Recovery | ECS launches replacement tasks in remaining AZs; RDS fails over to standby |
| Manual action | Monitor recovery; scale up if needed |
| RTO | < 15 minutes |

### 6.3 Scenario 3: RDS Database Failure

| Attribute | Details |
|-----------|---------|
| Impact | Platform read/write operations unavailable |
| Detection | RDS event notifications, application error rates |
| Recovery | Multi-AZ automatic failover (60-120 seconds); if failover unsuccessful, point-in-time restore |
| Manual action | Verify failover success; if manual restore needed, initiate point-in-time recovery |
| RTO | 2 minutes (automatic failover) to 4 hours (manual restore) |
| RPO | 0 (automatic failover) to 1 hour (point-in-time restore) |

### 6.4 Scenario 4: Full Region Failure

| Attribute | Details |
|-----------|---------|
| Impact | Complete platform outage |
| Detection | Route 53 health checks, external monitoring |
| Recovery | Activate DR region infrastructure; restore from cross-region backups |
| Manual action | Execute full DR runbook (see Section 6.5) |
| RTO | 4-8 hours |
| RPO | 1 hour (database) |

### 6.5 Full Region DR Runbook

1. **Declare disaster**: CISO or designated authority declares regional DR activation.
2. **Notify team**: Alert all IRT members and key stakeholders via out-of-band communication.
3. **Activate DR region**:
   a. Run Terraform apply against [DR_REGION] configuration.
   b. Restore RDS from latest cross-region backup.
   c. Verify S3 cross-region replication is current.
   d. Deploy latest Docker image to ECS in DR region.
4. **Update DNS**: Update Route 53 records to point to DR region infrastructure.
5. **Validate**: Run smoke tests against DR environment.
6. **Communicate**: Notify customers of recovery status via status page and email.
7. **Monitor**: Enhanced monitoring for 72 hours post-failover.
8. **Plan failback**: Develop plan to return to primary region when available.

### 6.6 Scenario 5: Third-Party Service Failure

| Service | Impact | Mitigation |
|---------|--------|------------|
| Google Gemini API | AI extraction processing unavailable | Queue extraction requests; process when service restored; evaluate alternative models |
| AgentMail | Email-based extraction unavailable | Queue incoming emails; process when restored |
| Neon (Legacy) | Legacy database access unavailable | Accelerate migration to RDS; data available in RDS for migrated customers |
| GitHub | CI/CD unavailable | Continue operating current deployment; defer non-critical changes |

## 7. Roles and Responsibilities

| Role | Name | BCP Responsibilities |
|------|------|---------------------|
| **BCP Owner** | [CISO_NAME] | Overall BCP ownership, activation authority, testing coordination |
| **BCP Coordinator** | [BCP_COORDINATOR] | Day-to-day BCP maintenance, testing logistics, documentation |
| **Infrastructure Lead** | [INFRA_LEAD] | AWS infrastructure recovery, backup management, DR execution |
| **Application Lead** | [APP_LEAD] | Application deployment, data integrity validation |
| **Communications Lead** | [COMMS_LEAD] | Customer and stakeholder communications during disruptions |
| **Executive Sponsor** | [CEO_NAME] | Strategic decisions, resource allocation, external relations |

## 8. DR Testing

### 8.1 Testing Schedule

| Test Type | Frequency | Scope | Participants |
|-----------|-----------|-------|-------------|
| Backup restoration test | Quarterly | Restore RDS from backup; validate data integrity | Infrastructure Lead |
| ECS failover test | Quarterly | Simulate task/AZ failure; verify auto-recovery | Infrastructure + Application Leads |
| Tabletop exercise | Semi-annually | Walk through DR scenarios with key stakeholders | BCP Owner + all role holders |
| Partial DR test | Annually | Activate DR region infrastructure; deploy application; run tests | Full IRT |
| Full DR test | Annually | Complete region failover including DNS cutover (scheduled maintenance window) | Full IRT + Communications |

### 8.2 Test Documentation

Each DR test shall produce a report containing:

- Test date, type, and scope
- Participants
- Scenario description
- Steps executed
- Results (pass/fail for each step)
- Actual RTO/RPO achieved vs. targets
- Issues identified
- Improvement actions with owners and deadlines

### 8.3 Test Results Tracking

| Metric | Target |
|--------|--------|
| Tests completed on schedule | 100% |
| RTO achieved within target | 100% |
| RPO achieved within target | 100% |
| Test improvement actions completed | > 90% within deadline |

## 9. Plan Activation

### 9.1 Activation Criteria

The BCP shall be activated when:

- A P1 incident is declared and estimated resolution exceeds the maximum tolerable downtime for any critical function.
- An AWS region failure is confirmed or expected to last more than 1 hour.
- A critical third-party service failure is expected to last more than 4 hours.
- The BCP Owner or Executive Sponsor determines activation is necessary.

### 9.2 Activation Authority

| Scenario | Activation Authority |
|----------|---------------------|
| Automated failover (AZ failure, task failure) | Automatic (no manual activation) |
| Regional DR activation | CISO or CEO |
| Third-party contingency activation | CISO |

### 9.3 Deactivation

The BCP shall be deactivated when:

- All critical functions have been restored to normal operation.
- RTO/RPO targets have been met.
- The BCP Owner confirms that normal operations have resumed.
- A post-incident review has been scheduled.

## 10. Plan Maintenance

| Activity | Frequency | Responsible |
|----------|-----------|-------------|
| Full BCP review | Annually | BCP Owner |
| Contact information update | Quarterly | BCP Coordinator |
| Recovery procedure validation | After each infrastructure change | Infrastructure Lead |
| Third-party dependency review | Semi-annually | BCP Coordinator |
| Lessons learned integration | After each incident or test | BCP Owner |

## 11. Related Documents

| Document | Document ID |
|----------|-------------|
| Information Security Policy | ISMS-POL-001 |
| Risk Assessment Methodology | ISMS-PROC-001 |
| Incident Response Plan | ISMS-PLAN-001 |
| Change Management Procedure | ISMS-PROC-002 |
| Data Retention Policy | ISMS-POL-004 |

## 12. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [DATE] | [AUTHOR] | Initial release |

## 13. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CISO | [CISO_NAME] | | [DATE] |
| CEO | [CEO_NAME] | | [DATE] |
