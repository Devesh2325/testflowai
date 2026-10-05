/**
 * Industry Standard QA Document Templates
 * Conforms to IEEE 829, ISTQB, and Modern Agile QA Best Practices.
 */

export interface QATemplate {
  id: string;
  title: string;
  type: "plan" | "strategy" | "rtm" | "report";
  category: string;
  description: string;
  content: string;
}

export const QA_TEMPLATES: QATemplate[] = [
  {
    id: "ieee-829-test-plan",
    title: "IEEE 829 Standard Test Plan",
    type: "plan",
    category: "Planning",
    description: "Industry-standard comprehensive test plan covering scope, approach, resources, schedule, and pass/fail criteria.",
    content: `# IEEE 829 Comprehensive Test Plan

## 1. Test Plan Identifier
**Project:** [Project Name]  
**Version:** 1.0.0  
**Date:** [YYYY-MM-DD]  
**Author:** [Lead QA Engineer]  
**Status:** [Draft / Approved / In Progress]

---

## 2. Introduction & Purpose
This test plan describes the testing approach, overall framework, and schedule for the **[Feature / Release Name]**. It details items to be tested, items not to be tested, testing strategies, resource requirements, and risk management.

---

## 3. Test Items (Scope)
### In Scope:
- [ ] User Authentication & Authorization (Login, Signup, SSO, MFA, Password Reset)
- [ ] Core Business Workflows: [e.g. Checkout, Cart, Payment Gateway Integration]
- [ ] REST API Endpoints: [e.g. /api/v1/orders, /api/v1/users]
- [ ] Responsive Viewports (Desktop: 1920x1080, Tablet: 768x1024, Mobile: 375x667)
- [ ] Cross-browser Compatibility (Chrome, Firefox, Safari, Edge)

### Out of Scope:
- [ ] Load & Stress testing exceeding 50,000 concurrent users (handled in Phase 2)
- [ ] Third-party legacy CRM internal sync modules
- [ ] Native mobile hardware biometric validation (iOS FaceID / Android Fingerprint)

---

## 4. Features to be Tested & Test Strategy
| Feature / Module | Test Type | Technique Applied | Primary Assignee |
| :--- | :--- | :--- | :--- |
| Authentication | Functional & Security | Boundary Value Analysis, Negative Testing | Senior QA |
| Checkout Flow | End-to-End & UI | Happy Path, State Transition, Card Validation | QA Tester |
| Search & Filter | Performance & Functional | Equivalence Partitioning, Response Time | QA Engineer |
| API Endpoints | Integration | Status Code Verification, Schema Validation | API / Automation QA |

---

## 5. Pass / Fail Criteria
### Suspension Criteria:
- Occurrence of **Critical (P1 / Blocker)** defects blocking core testing paths.
- Build deployment failure or unstable testing environment (> 30% downtime).

### Resumption Criteria:
- Fix deployed, verified by QA via smoke test suite in under 15 minutes.

### Exit / Sign-Off Criteria:
- **100%** of critical and high-priority test cases executed.
- Minimum **95%** overall test execution pass rate.
- **0 open Blocker or Critical defects**.
- All open Medium/Low defects documented with approved workarounds.

---

## 6. Test Deliverables
1. Detailed Test Cases in TestFlow AI
2. Daily QA Execution Status Reports
3. Defect Bug Reports in Kanban Tracker
4. Automated Regression Execution Report (Playwright)
5. Final QA Release Sign-Off Certificate

---

## 7. Environmental & Tool Requirements
- **Test Management:** TestFlow AI Platform
- **Automation Framework:** Playwright / TypeScript
- **Target Environments:** Staging (URL: \`https://staging.app.example.com\`)
- **Browsers:** Google Chrome (v120+), Firefox (v120+), Safari (v17+), Edge (v120+)
- **Test Data:** Pre-seeded QA user accounts with specified roles (Admin, Editor, Viewer)

---

## 8. Risk Management & Mitigation
| Identified Risk | Likelihood | Impact | Mitigation Strategy |
| :--- | :---: | :---: | :--- |
| Late code drops from development | High | High | Enforce strict code freeze 48h before release candidate. |
| Test environment instability | Med | High | Maintain local fallback mocks and isolated Docker environment. |
| Scope creep during sprint | Med | Med | Any changes require written sign-off and triage impact analysis. |

---

## 9. Approvals & Sign-Off
- **QA Lead:** _______________________ Date: _________
- **Engineering Manager:** ____________ Date: _________
- **Product Manager:** ________________ Date: _________
`,
  },
  {
    id: "istqb-test-strategy",
    title: "ISTQB Master Test Strategy",
    type: "strategy",
    category: "Strategy",
    description: "High-level organizational test strategy defining testing levels, automation pyramid, defect management, and tooling.",
    content: `# ISTQB Master Test Strategy

## 1. Document Overview
**Organization:** [Company / Department]  
**Scope:** Multi-Project / Enterprise QA Strategy  
**Revision:** 2.1  
**Target Architecture:** Microservices, SPA Frontend, Cloud Infrastructure

---

## 2. Test Strategy Principles
Our testing methodology follows the **ISTQB Testing Principles**:
1. Testing shows the presence of defects, not their absence.
2. Exhaustive testing is impossible; risk-based testing is required.
3. Early testing saves time and money (Shift-Left approach).
4. Defects cluster together (80/20 Pareto principle).
5. Tests must be updated to prevent the pesticide paradox.
6. Testing is context-dependent.
7. Absence-of-errors fallacy: verified software must satisfy business needs.

---

## 3. Testing Pyramid & Level Allocation
\`\`\`
       /\\
      /  \\      E2E & UI Tests (10%) - Playwright / Manual Exploratory
     /----\\
    /      \\    Integration & API Tests (30%) - Postman / REST Assured
   /--------\\
  /          \\  Unit & Component Tests (60%) - Vitest / Jest / RTL
 /------------\\
\`\`\`

### Testing Levels:
- **Unit Testing:** Executed by Developers on pull request commit. 80% coverage threshold.
- **Integration Testing:** API contract validation, database transaction integrity.
- **System Testing:** End-to-end user workflows, performance benchmarking, security scanning.
- **Acceptance Testing (UAT):** Business stakeholder verification against user stories.

---

## 4. Test Design Techniques Applied
- **Black-Box Techniques:**
  - Equivalence Partitioning (EP)
  - Boundary Value Analysis (BVA)
  - Decision Table Testing
  - State Transition Testing
- **Experience-Based Techniques:**
  - Exploratory Testing via Session Charters (SBTM)
  - Error Guessing based on historical defect data

---

## 5. Defect Classification & SLA
| Severity | Description | Response SLA | Resolution SLA |
| :--- | :--- | :---: | :---: |
| **Critical / Blocker** | System down, payment failure, data corruption, security breach | < 30 mins | < 4 hours |
| **High / Major** | Core feature broken with no feasible workaround | < 2 hours | < 24 hours |
| **Medium / Minor** | Non-critical feature defect with available workaround | < 8 hours | Next Sprint |
| **Low / Trivial** | Cosmetic, spelling error, alignment glitch | Backlog | As scheduled |

---

## 6. Automation & CI/CD Pipeline Integration
- Automated smoke suite runs automatically on each staging deploy (< 5 mins).
- Full regression suite scheduled every 6 hours via QA Recorder / GitHub Actions.
- Pull request gating prevents merging code with failing automated tests.
`,
  },
  {
    id: "rtm-template",
    title: "Requirements Traceability Matrix (RTM)",
    type: "rtm",
    category: "Traceability",
    description: "Bidirectional traceability matrix mapping business requirements directly to test cases and defects.",
    content: `# Requirements Traceability Matrix (RTM)

**Project:** [Project Name]  
**Sprint / Milestone:** [Sprint 14 / Release v2.4]  
**Last Updated:** [YYYY-MM-DD]

---

## Traceability Grid

| Req ID | User Story / Requirement | Test Case ID | Test Case Title | Execution Status | Defect ID | Sign-Off |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **REQ-101** | User can reset password via email OTP | TC-001 | Valid email password reset OTP trigger | **PASS** | — | Verified |
| **REQ-101** | User can reset password via email OTP | TC-002 | Expired OTP entry shows error message | **PASS** | — | Verified |
| **REQ-102** | User can update profile avatar image | TC-003 | Upload valid JPEG/PNG avatar (< 5MB) | **PASS** | — | Verified |
| **REQ-102** | User can update profile avatar image | TC-004 | Upload oversized file (> 10MB) blocked | **FAIL** | BUG-042 | Re-Test |
| **REQ-103** | Checkout enforces credit card Luhn check | TC-005 | Valid VISA credit card payment | **PASS** | — | Verified |
| **REQ-103** | Checkout enforces credit card Luhn check | TC-006 | Invalid card number triggers inline validation | **PASS** | — | Verified |
| **REQ-104** | Export orders report to CSV format | TC-007 | Export 1,000 orders to CSV | **BLOCKED** | BUG-045 | Pending |

---

## Summary Metrics
- **Total Requirements Mapped:** 4
- **Total Test Cases Linked:** 7
- **Test Coverage:** 100%
- **Passed:** 5 (71%)
- **Failed:** 1 (14%)
- **Blocked:** 1 (14%)
- **Open Defects:** 2
`,
  },
  {
    id: "release-signoff-certificate",
    title: "QA Release Sign-Off Certificate",
    type: "report",
    category: "Reporting",
    description: "Official QA release readiness declaration with defect summary, risk evaluation, and Go/No-Go decision.",
    content: `# QA Release Sign-Off Certificate

## Release Details
- **Product Name:** [Product Name]
- **Release Version:** \`v2.4.0-RC3\`
- **Deployment Date:** [YYYY-MM-DD]
- **QA Lead:** [Lead QA Engineer]
- **Verdict:** **[ GO / NO-GO / CONDITIONAL GO ]**

---

## 1. Executive Summary
The QA team has completed testing for release **v2.4.0**. All functional, regression, cross-browser, and performance criteria have been verified against the acceptance criteria outlined in the Test Plan.

---

## 2. Test Execution Summary
| Metric | Count | Percentage |
| :--- | :---: | :---: |
| Total Planned Test Cases | 124 | 100% |
| Executed Test Cases | 124 | 100% |
| **Passed Test Cases** | **120** | **96.8%** |
| Failed Test Cases | 2 | 1.6% |
| Blocked / Skipped Test Cases | 2 | 1.6% |

---

## 3. Defect Distribution Status
- **Blocker (P1):** 0
- **Critical (P2):** 0
- **Major (P3):** 1 *(Accepted for hotfix in v2.4.1)*
- **Minor / Trivial (P4):** 3 *(Documented in release notes)*

---

## 4. Known Issues & Workarounds
1. **BUG-089 (Minor):** Dark mode toggle on Firefox Android occasionally flashes white for 200ms during page load.  
   *Workaround:* Non-blocking cosmetic glitch.
2. **BUG-094 (Major):** Bulk export of > 10,000 records times out on slower connections.  
   *Mitigation:* Temporary 5,000 record pagination limit enforced on UI.

---

## 5. Final Recommendation & Sign-Off
> **RECOMMENDATION: GO FOR PRODUCTION DEPLOYMENT**  
> All exit criteria have been satisfied. Zero critical blockers remain open.

- **QA Lead Sign-Off:** ____________________ Date: ________
- **Release Manager Sign-Off:** _____________ Date: ________
`,
  },
  {
    id: "exploratory-session-charter",
    title: "Exploratory Testing Charter (SBTM)",
    type: "plan",
    category: "Exploratory",
    description: "Session-Based Test Management charter for focused, timeboxed exploratory manual testing sessions.",
    content: `# Exploratory Testing Charter (SBTM)

## Charter Mission
> **Explore:** [Target Area, e.g. Shopping Cart & Discount Promo Codes]  
> **With:** [Personas, Test Data, Tools, e.g. Guest user, expired coupon codes, invalid currency symbols]  
> **To Discover:** [Potential edge cases, rounding errors, state inconsistencies, checkout loopholes]

---

## Session Details
- **Tester:** [QA Engineer Name]
- **Date & Time:** [YYYY-MM-DD HH:MM]
- **Timebox Duration:** 60 Minutes (Normal: 60-90 mins)
- **Target Environment:** Staging (\`https://staging.example.com\`)
- **Device / Browser:** Desktop Chrome (DevTools Network Throttling active)

---

## Areas of Focus & Heuristics
- [ ] Test rapid multiple clicks on "Apply Promo Code" button (Race conditions)
- [ ] Test negative, zero, and fractional discount percentages
- [ ] Test applying coupons with expired date timestamps
- [ ] Test browser back button during checkout progression
- [ ] Inspect browser DevTools Console for unhandled JavaScript exceptions
- [ ] Test network interruption (Offline mode toggle) mid-transaction

---

## Session Execution Log
- **[00:00 - 00:15] Setup & Baseline:** Created guest cart with 3 items. Tested single standard 10% coupon. Worked as expected.
- **[00:15 - 00:35] Boundary Testing:** Applied coupon \`DISCOUNT100\` on cart with shipping fee. Found shipping was incorrectly deducted!
- **[00:35 - 00:50] Stress & Race Conditions:** Clicked apply coupon button 10 times rapidly; detected duplicate request dispatch.
- **[00:50 - 01:00] Wrap-up & Bug Filing:** Logged 2 bug reports with screenshots and network logs.

---

## Bugs Discovered
1. **BUG-101:** Multiple rapid clicks on discount button triggers redundant network calls.
2. **BUG-102:** Zero-dollar cart balance allows checkout without entering required billing address.

---

## Questions & Follow-Up
- Question for Product: Should promo codes apply before or after sales tax calculation?
`,
  },
];
