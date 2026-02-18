# Change Management Procedure

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Document ID**  | ISMS-PROC-002                              |
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

This Change Management Procedure defines the process for requesting, evaluating, approving, implementing, and reviewing changes to Extrapl information systems, infrastructure, and applications. It ensures that changes are made in a controlled manner that minimizes risk to the confidentiality, integrity, and availability of information assets.

This procedure is aligned with ISO/IEC 27001:2022 Annex A, Control A.8.32 (Change Management), and supports the Extrapl Information Security Policy (ISMS-POL-001).

## 2. Scope

This procedure applies to all changes affecting:

- The Extrapl SaaS platform (application code, configuration, features).
- AWS infrastructure (ECS, RDS, S3, VPC, IAM, security groups, etc.).
- Terraform infrastructure-as-code configurations.
- CI/CD pipelines (GitHub Actions workflows).
- Third-party service integrations and configurations.
- Database schemas and data migrations.
- Security controls and policies (firewall rules, WAF configurations, IAM policies).
- DNS configurations and SSL/TLS certificates.

## 3. Change Types

### 3.1 Standard Changes

Pre-approved, low-risk, routine changes that follow a documented procedure and do not require individual change approval.

| Standard Change | Pre-Approval Condition |
|----------------|----------------------|
| Dependency patch updates (non-breaking) | Passes CI pipeline, no critical vulnerabilities introduced |
| Minor UI/UX adjustments | Passes code review and CI pipeline |
| Documentation updates | Peer review completed |
| Log level adjustments | Reviewed by team lead |
| Scaling adjustments within defined thresholds | Within auto-scaling policy bounds |
| Certificate renewal (automated) | Automated via ACM/Let's Encrypt |

Standard changes still require:
- Code review (PR approval)
- Passing CI pipeline
- Deployment through the standard pipeline (staging then production)

### 3.2 Normal Changes

Changes that require formal evaluation, approval, and scheduling. These include feature development, architectural changes, infrastructure modifications, and security control changes.

| Risk Level | Examples | Approval Required |
|------------|---------|-------------------|
| Low | New non-critical feature, minor API changes, non-production infrastructure changes | 1 peer review + team lead approval |
| Medium | Database schema changes, new third-party integration, IAM policy changes | 2 peer reviews + CTO or CISO approval |
| High | Architecture changes, production database migration, security control modifications, network changes | 2 peer reviews + CTO approval + CISO review |

### 3.3 Emergency Changes

Changes required to resolve a P1 or P2 incident or to address a critical security vulnerability that cannot wait for the normal change process.

| Attribute | Requirement |
|-----------|-------------|
| Authorization | Verbal approval from CISO or CTO; documented within 24 hours |
| Implementation | May bypass staging; direct to production if necessary |
| Review | Post-implementation review required within 48 hours |
| Documentation | Full change record completed within 24 hours of implementation |
| Risk | Accepted by the authorizing party; documented in incident record |

## 4. Change Request Process

### 4.1 Process Flow

```
Request --> Assessment --> Approval --> Implementation --> Verification --> Closure
    |           |             |              |                |              |
    |           |             |         [Rollback if         |              |
    |           |             |          issues]             |              |
    |           |             |              |                |              |
    v           v             v              v                v              v
 GitHub      Risk &       PR Review     Deploy to        Smoke Tests    Post-Impl
 Issue/PR    Impact       + Approvals   Staging -->      + Monitoring   Review
             Analysis                   Production
```

### 4.2 Step 1: Change Request

All changes are initiated through one of the following:

| Change Origin | Documentation Method |
|---------------|---------------------|
| Feature development | GitHub Issue + Pull Request |
| Bug fix | GitHub Issue + Pull Request |
| Infrastructure change | GitHub Issue + Pull Request (Terraform) |
| Configuration change | GitHub Issue + Pull Request |
| Emergency change | Incident record + retrospective Pull Request |

Every change request (Pull Request) must include:

- Description of the change and its purpose
- Type of change (standard/normal/emergency)
- Systems and services affected
- Risk assessment (for normal and emergency changes)
- Testing plan
- Rollback plan
- Any dependencies or prerequisites

### 4.3 Step 2: Assessment

| Assessment Area | Evaluation Criteria |
|----------------|-------------------|
| Security impact | Does the change affect authentication, authorization, encryption, or data handling? |
| Availability impact | Could the change cause downtime or degraded performance? |
| Data impact | Does the change modify database schemas, data processing, or data storage? |
| Compliance impact | Does the change affect regulatory compliance (GDPR, SOC 2, ISO 27001)? |
| Third-party impact | Does the change affect or depend on third-party services? |
| Rollback complexity | How difficult is it to reverse the change if issues arise? |

### 4.4 Step 3: Approval

#### Code Review Requirements

| Change Scope | Minimum Reviews | Required Reviewers |
|-------------|----------------|-------------------|
| Application code | 1 approved review | Team member with domain knowledge |
| Infrastructure (Terraform) | 2 approved reviews | Infrastructure team + CISO or CTO |
| Security controls | 2 approved reviews | CISO + one additional reviewer |
| Database migrations | 2 approved reviews | Database owner + CTO |
| CI/CD pipeline | 1 approved review | Infrastructure team member |

#### Branch Protection Rules

The following branch protections are enforced on the `main` branch:

- Require pull request reviews before merging
- Require status checks to pass (CI pipeline)
- Require branches to be up to date before merging
- Require signed commits (encouraged; required for release branches)
- No direct pushes to main
- No force pushes

### 4.5 Step 4: Staging Gate

All normal changes must pass through the staging environment before production deployment.

| Staging Requirement | Details |
|-------------------|---------|
| Deployment | Change is deployed to the staging environment via the CI/CD pipeline |
| Automated tests | CI pipeline tests (type checking, linting, unit tests, security scans) must pass |
| Smoke tests | Automated health checks and API responsiveness verified |
| Manual verification | Change owner verifies the change functions as expected in staging |
| Soak period | Changes should remain in staging for a minimum of [SOAK_PERIOD] before production promotion (waivable for urgent fixes) |

### 4.6 Step 5: Production Deployment

| Requirement | Details |
|-------------|---------|
| Approval | Production deployment requires explicit approval via GitHub Environment protection rules |
| Method | Manual trigger of the Deploy to Production workflow |
| Monitoring | Deployer must monitor deployment and verify stability |
| Rollback readiness | Previous working image tag must be documented before deployment |
| Deployment window | Standard deployments during business hours (with on-call coverage) |
| High-risk deployments | Scheduled during low-traffic windows; communicated to stakeholders in advance |

### 4.7 Step 6: Post-Implementation Verification

| Verification | Method | Timeline |
|-------------|--------|----------|
| Smoke tests | Automated health check and API responsiveness (part of deployment pipeline) | Immediately |
| Error rate monitoring | CloudWatch alarms for elevated 5xx rates | 30 minutes post-deployment |
| Performance monitoring | Response time and resource utilization metrics | 1 hour post-deployment |
| Functional verification | Manual verification by change owner for non-trivial changes | Within 2 hours |
| Customer impact check | Review support channels for reported issues | 24 hours post-deployment |

## 5. Rollback Procedures

### 5.1 Automated Rollback

| Trigger | Action |
|---------|--------|
| ECS deployment circuit breaker | Automatic rollback to previous task definition |
| Smoke test failure in deployment pipeline | Pipeline fails; previous version remains active |

### 5.2 Manual Rollback

| Scenario | Procedure |
|----------|-----------|
| Application rollback | Re-deploy previous Docker image tag via the production deployment workflow |
| Infrastructure rollback | Revert Terraform changes; apply previous state |
| Database migration rollback | Execute documented rollback migration; validate data integrity |
| Configuration rollback | Revert configuration changes via PR; redeploy |

### 5.3 Rollback Decision Criteria

A rollback should be initiated when:

- Critical functionality is broken in production.
- Error rates exceed acceptable thresholds post-deployment.
- A security vulnerability is introduced by the change.
- Performance degradation exceeds acceptable thresholds.
- The Incident Commander or on-call engineer determines the change is causing user impact.

Rollback authority:

| Change Type | Rollback Authority |
|------------|-------------------|
| Standard | On-call engineer or deployer |
| Normal | Change owner, team lead, or CTO |
| Emergency | Incident Commander |

## 6. Testing Requirements

### 6.1 Testing Matrix

| Change Type | Unit Tests | Integration Tests | Security Scan | Staging Deploy | Smoke Test | Manual QA |
|------------|-----------|------------------|--------------|----------------|-----------|-----------|
| Standard | Required | If applicable | Required (CI) | Required | Required | Optional |
| Normal (Low) | Required | Required | Required (CI) | Required | Required | Recommended |
| Normal (Medium) | Required | Required | Required (CI) | Required | Required | Required |
| Normal (High) | Required | Required | Required (CI + manual) | Required | Required | Required |
| Emergency | Best effort | Best effort | Required (CI) | May be skipped | Required | Post-deployment |

### 6.2 Database Change Testing

Database schema changes require additional testing:

1. Migration tested against a copy of the staging database.
2. Rollback migration tested and verified.
3. Performance impact assessed (query plans for affected tables).
4. Data integrity checks before and after migration.
5. Backup taken immediately before production migration.

## 7. Post-Implementation Review

### 7.1 Review Requirements

| Change Type | PIR Required | Timeline |
|------------|-------------|----------|
| Standard | Not required | N/A |
| Normal (Low) | Not required | N/A |
| Normal (Medium) | Recommended | Within 1 week |
| Normal (High) | Required | Within 1 week |
| Emergency | Required | Within 48 hours |
| Failed/rolled-back changes | Required | Within 48 hours |

### 7.2 PIR Content

Post-implementation reviews shall cover:

- Was the change implemented as planned?
- Were there any unexpected issues during or after implementation?
- Was the rollback plan adequate?
- Were the testing and approval processes sufficient?
- What improvements should be made to the change process?
- Are any follow-up actions required?

## 8. Change Freeze Periods

| Period | Duration | Scope | Exception Process |
|--------|----------|-------|-------------------|
| End-of-quarter freeze | Last 3 business days of each quarter | All non-emergency changes | CISO + CTO approval |
| Major customer event freeze | As communicated | All non-emergency changes | CISO + CTO approval |
| Post-incident stabilization | 48 hours after P1 incident resolution | Non-related changes | CISO approval |

## 9. Metrics and Reporting

The following metrics shall be tracked and reported monthly:

| Metric | Target |
|--------|--------|
| Change success rate (no rollback required) | > 95% |
| Emergency change percentage | < 10% of all changes |
| Mean time from PR to production | < [TARGET] days |
| Changes with complete documentation | 100% |
| Post-implementation reviews completed on time | 100% (for required PIRs) |
| Changes causing incidents | < 5% |

## 10. Related Documents

| Document | Document ID |
|----------|-------------|
| Information Security Policy | ISMS-POL-001 |
| Risk Assessment Methodology | ISMS-PROC-001 |
| Incident Response Plan | ISMS-PLAN-001 |
| Business Continuity Plan | ISMS-PLAN-002 |
| Access Control Policy | ISMS-POL-002 |

## 11. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [DATE] | [AUTHOR] | Initial release |

## 12. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CISO | [CISO_NAME] | | [DATE] |
| CEO | [CEO_NAME] | | [DATE] |
