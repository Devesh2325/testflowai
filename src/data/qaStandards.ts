/**
 * Comprehensive QA & Manual Tester Knowledge Base & Standards
 * Based on ISTQB Foundation & Advanced Syllabus, IEEE 829, and Modern Agile QA.
 */

export interface QAStandardSection {
  id: string;
  title: string;
  badge: string;
  summary: string;
  content: string;
  cheatSheet?: { label: string; value: string; note: string }[];
}

export const QA_STANDARDS: QAStandardSection[] = [
  {
    id: "istqb-test-design",
    title: "ISTQB Test Design Techniques",
    badge: "Core Methodology",
    summary: "Formal black-box test design techniques: Boundary Value Analysis, Equivalence Partitioning, Decision Tables, and State Transitions.",
    content: `
### 1. Boundary Value Analysis (BVA)
Defects are overwhelmingly concentrated at the boundary edges of input ranges rather than in the center.

- **2-Value BVA:** For range \`[min, max]\`, test:
  - Minimum boundary: \`min\` and \`min - 1\`
  - Maximum boundary: \`max\` and \`max + 1\`
- **3-Value BVA (Advanced/High-Risk):**
  - Minimum boundary: \`min - 1\`, \`min\`, \`min + 1\`
  - Maximum boundary: \`max - 1\`, \`max\`, \`max + 1\`

#### Real-World Example:
*Requirement:* Age input must be between **18** and **65** inclusive.
- **Valid Boundary Values:** \`18\`, \`19\`, \`64\`, \`65\`
- **Invalid Boundary Values:** \`17\` (Too young), \`66\` (Too old)
- **Extreme Boundary Values:** \`0\`, \`-1\`, \`999\`, \`null\`

---

### 2. Equivalence Partitioning (EP)
Divides the input domain of a system into partitions of equivalent data from which test cases can be derived. If one value in a partition fails, all other values in that partition are presumed to fail.

#### Partition Categories:
1. **Valid Equivalence Partitions:** Inputs that should be accepted by the system.
2. **Invalid Equivalence Partitions:** Inputs that should be rejected with graceful validation feedback.

#### Real-World Example:
*Requirement:* Order quantity must be an integer between 1 and 99.
- **Partition 1 (Invalid):** \`Quantity <= 0\` (e.g. \`-5\`, \`0\`) ➔ Expected: Error "Quantity must be at least 1"
- **Partition 2 (Valid):** \`1 <= Quantity <= 99\` (e.g. \`15\`) ➔ Expected: Added to cart successfully
- **Partition 3 (Invalid):** \`Quantity >= 100\` (e.g. \`105\`) ➔ Expected: Error "Maximum order limit is 99"
- **Partition 4 (Invalid Type):** Non-numeric / Decimals (e.g. \`"abc"\`, \`2.5\`) ➔ Expected: Inline input validation block

---

### 3. Decision Table Testing
Used for complex business logic involving multiple combinations of conditions resulting in different actions.

| Condition / Rule | Rule 1 | Rule 2 | Rule 3 | Rule 4 |
| :--- | :---: | :---: | :---: | :---: |
| Registered User? | Yes | Yes | No | No |
| Coupon Valid? | Yes | No | Yes | No |
| Order > $100? | Yes | Yes | Yes | No |
| **Action: Apply 20% Discount** | **X** | — | — | — |
| **Action: Free Shipping** | **X** | **X** | **X** | — |
| **Action: Standard Price** | — | — | — | **X** |

---

### 4. State Transition Testing
Tests how a system transitions between different states based on events and conditions.

\`\`\`
[Draft] --(Submit)--> [Under Review] --(Approve)--> [Published]
  ^                          |
  |--------(Reject)----------|
\`\`\`

- **Valid Transitions:** Verify every positive path between states.
- **Invalid Transitions:** Attempt actions not permitted in the current state (e.g. trying to "Approve" an article while still in "Draft" state).
`,
    cheatSheet: [
      { label: "BVA (2-value)", value: "min-1, min, max, max+1", note: "Essential for all numerical inputs & date fields" },
      { label: "EP Valid", value: "Representative value inside boundary", note: "Reduces redundant test executions" },
      { label: "EP Invalid", value: "Representative values outside each boundary", note: "Verifies error handling & sanitization" },
      { label: "State Testing", value: "100% 0-switch transition coverage", note: "Validates all valid and invalid state flows" },
    ],
  },
  {
    id: "test-case-writing-gold-standard",
    title: "Test Case Writing Gold Standard",
    badge: "Authoring",
    summary: "Guidelines, structure, Gherkin BDD format, and good vs bad examples for authoring maintainable, unambiguous test cases.",
    content: `
### Anatomy of a Production-Grade Test Case
Every professional test case must be clear enough that any engineer or new manual tester can execute it without asking questions.

1. **Test Case ID:** Unique identifier (e.g., \`TC-AUTH-001\`).
2. **Title:** Clear, action-oriented description containing the condition and expected result.
3. **Module / Component:** Logical grouping (e.g., \`Authentication\`, \`Billing\`).
4. **Priority:** Critical, High, Medium, or Low.
5. **Type:** Functional, Smoke, Regression, Security, UI, Performance.
6. **Preconditions:** System state required before starting (e.g., "User is logged in as Admin with active subscription").
7. **Test Data:** Specific inputs, credentials, or payloads to be used.
8. **Test Steps:** Numbered, atomic instructions with explicit user actions.
9. **Expected Result:** Concrete, verifiable outcome for each critical step.
10. **Postconditions:** Clean-up actions (e.g., "Delete test user from database").

---

### Good vs. Bad Test Case Examples

#### ❌ Bad Test Case:
- **Title:** Test login.
- **Steps:** Go to login page, enter email and password, click submit.
- **Expected Result:** Login works.
*(Why it's bad: What email? What password? What does "works" mean? What is the expected redirect URL?)*

#### ✅ Good Test Case:
- **ID:** \`TC-AUTH-012\`
- **Title:** Verify successful user login with valid credentials redirects to Dashboard.
- **Preconditions:** User account \`qa.tester@example.com\` exists and is verified in staging database.
- **Test Steps:**
  1. Navigate to \`https://staging.example.com/login\`.
  2. Enter \`qa.tester@example.com\` into the **Email** field.
  3. Enter \`SecurePass123!\` into the **Password** field.
  4. Click the **"Sign In"** button.
- **Expected Results:**
  1. Login button displays a temporary loading spinner for < 1000ms.
  2. User is redirected to \`https://staging.example.com/app/dashboard\`.
  3. Top navigation displays avatar with user's full name "QA Tester".
  4. Session token is stored in \`localStorage\` under key \`auth_token\`.

---

### Gherkin BDD (Given-When-Then) Standard
For teams using Behavior-Driven Development:

\`\`\`gherkin
Feature: Checkout Discount Promo Code

  Scenario: Applying a valid 15% promotional discount
    Given the user has 2 items in their shopping cart totaling $100.00
    And the user is on the Checkout page
    When the user enters coupon code "SUMMER15" into the promo field
    And clicks the "Apply Coupon" button
    Then a green badge "15% Discount Applied (-$15.00)" should be visible
    And the total order amount should update to $85.00
    And the order summary line item shows "Discount: -$15.00"
\`\`\`
`,
    cheatSheet: [
      { label: "Given", value: "Precondition / Context", note: "The initial state of the application" },
      { label: "When", value: "User Action / Trigger", note: "The action performed by the user" },
      { label: "Then", value: "Observable Expected Outcome", note: "The verifiable system response" },
      { label: "Atomic Steps", value: "Max 3-7 steps per test case", note: "Split longer flows into modular tests" },
    ],
  },
  {
    id: "defect-reporting-severity-matrix",
    title: "Bug Reporting & Severity vs Priority Matrix",
    badge: "Defect Management",
    summary: "Standard defect reporting anatomy, Severity vs Priority matrix, and 5-Whys Root Cause Analysis.",
    content: `
### Severity vs Priority: The Critical Distinction
- **Severity:** The technical impact of the defect on the system architecture, data, or functionality. *(Determined by QA)*
- **Priority:** The urgency with which the defect must be fixed based on business goals, release schedule, or customer exposure. *(Determined by Product / Triage Lead)*

---

### The 4x4 Severity vs Priority Matrix

| Severity \\ Priority | P1 (Urgent / Immediate) | P2 (High) | P3 (Normal) | P4 (Low) |
| :--- | :--- | :--- | :--- | :--- |
| **Critical / Blocker** | System crash, data loss on production checkout. | Admin bulk export worker crashes; workaround available. | Rare edge case crash under extreme load condition. | N/A |
| **High / Major** | Core feature broken on main customer flow with no workaround. | Primary search filter returns wrong results. | Secondary analytics calculation inaccurate. | Obscure browser edge case on unsupported OS. |
| **Medium / Minor** | Misspelled company name on billing invoice page (Bad PR). | Form dropdown option truncated on small screens. | Validation error message displayed in generic red text. | Non-standard spacing on secondary dialog. |
| **Low / Trivial** | Minor typo on homepage hero banner. | Slight pixel alignment shift on footer copyright. | Hover tooltip color slightly off brand palette. | Minor spelling error in internal release log. |

---

### Anatomy of a Perfect Bug Report
1. **Title:** \`[Component] Concise description of problem [Environment/Device]\`  
   *Example:* \`[Checkout] Clicking 'Place Order' with expired card throws unhandled 500 Internal Error [Chrome/Desktop]\`
2. **Environment:** Staging v2.4.1, Chrome 122.0.6261.94, macOS Sonoma 14.3.
3. **Preconditions:** User has valid item in cart, navigating to payment step.
4. **Steps to Reproduce:**
   1. Go to \`https://staging.example.com/checkout\`.
   2. Select **Credit Card** payment method.
   3. Enter card number \`4111 2222 3333 4444\` with expiration date \`01/22\` (past date).
   4. Click **"Place Order"**.
5. **Expected Result:** Inline error message displays: *"Card expiration date is in the past"*. Form submission is blocked.
6. **Actual Result:** Application freezes for 5 seconds, then displays raw error alert: *"500 Server Error: Internal processing failure"*.
7. **Evidence:** Screenshot, browser console error log trace, network payload trace.
`,
    cheatSheet: [
      { label: "Critical (Blocker)", value: "Crashes system, data corruption, security leak", note: "Blocks all further testing" },
      { label: "High (Major)", value: "Core feature broken, no reasonable workaround", note: "High impact on user experience" },
      { label: "Medium (Minor)", value: "Feature broken but functional workaround exists", note: "Standard sprint fix" },
      { label: "Low (Trivial)", value: "Cosmetic, alignment, minor UI spelling", note: "Low impact on business operations" },
    ],
  },
  {
    id: "manual-testing-checklists",
    title: "Manual Testing Execution Checklists",
    badge: "Execution Ready",
    summary: "Production-ready QA checklists for Smoke, Sanity, Cross-Browser, Accessibility (WCAG 2.1 AA), and Security.",
    content: `
### 1. Smoke Testing Checklist (10–15 Mins Deployment Sanity)
- [ ] Application loads without HTTP 500/502/504 errors.
- [ ] User can log in with valid credentials.
- [ ] User can log out and session terminates cleanly.
- [ ] Core primary business flow executes end-to-end (e.g. view item ➔ add to cart ➔ view cart).
- [ ] Database connections and external microservices are responsive.
- [ ] Browser DevTools console shows zero fatal JavaScript runtime exceptions.

---

### 2. Regression Testing Checklist (Full Release Candidate)
- [ ] All resolved bug fixes verified in the current release build.
- [ ] Unchanged adjacent modules validated for unexpected side-effects.
- [ ] Form submission validations: empty inputs, special characters, max length, SQL injection strings (\`' OR 1=1 --\`).
- [ ] Session expiration: cookie timeout redirects user to login without data leak.
- [ ] Pagination, sorting, and search filtering across large datasets.
- [ ] Email / SMS notifications trigger properly with correct variables.

---

### 3. Accessibility Checklist (WCAG 2.1 Level AA)
- [ ] **Keyboard Navigation:** Every interactive element can be focused using <kbd>Tab</kbd> and activated with <kbd>Enter</kbd> / <kbd>Space</kbd>.
- [ ] **Focus Indicator:** Visible focus ring appears on active focused elements.
- [ ] **Color Contrast:** Text meets minimum contrast ratio of **4.5:1** against background (3:1 for large text).
- [ ] **Alt Text:** All informational \`<img>\` tags include descriptive \`alt\` attributes; decorative images use \`alt=""\`.
- [ ] **ARIA Roles:** Interactive custom elements use appropriate \`role\`, \`aria-label\`, and \`aria-expanded\` tags.
- [ ] **Form Labels:** Every \`<input>\` is explicitly linked to a \`<label>\` using \`for="id"\`.

---

### 4. Cross-Browser & Viewport Matrix
- [ ] **Desktop:** Chrome (Blink), Firefox (Gecko), Safari (WebKit), Edge (Chromium).
- [ ] **Mobile & Tablet:** iOS Safari (iPhone 14/15, iPad), Android Chrome (Pixel, Samsung Galaxy).
- [ ] **Responsive Breakpoints:** 375px (Mobile), 768px (Tablet portrait), 1024px (Tablet landscape), 1440px (Desktop), 1920px (Widescreen).
`,
    cheatSheet: [
      { label: "Smoke Test", value: "Quick critical path verification", note: "Run on every new staging build" },
      { label: "Regression Test", value: "Complete feature & boundary verification", note: "Run before major production release" },
      { label: "WCAG Contrast", value: "4.5:1 text, 3:1 large text", note: "Standard accessibility requirement" },
      { label: "Keyboard Nav", value: "Tab, Shift+Tab, Enter, Space, Escape", note: "Ensure zero keyboard traps" },
    ],
  },
  {
    id: "api-manual-testing-guide",
    title: "REST API Manual Testing Quick Reference",
    badge: "API Reference",
    summary: "HTTP methods, status codes classification, authentication header patterns, and payload assertions.",
    content: `
### HTTP Methods & Idempotency
- **GET:** Retrieve resource data. *Idempotent & Safe.*
- **POST:** Create a new resource. *Non-idempotent.*
- **PUT:** Complete replacement of an existing resource. *Idempotent.*
- **PATCH:** Partial update of an existing resource. *Non-idempotent.*
- **DELETE:** Remove resource. *Idempotent.*

---

### HTTP Status Code Cheat Sheet

| Code | Status | Meaning for QA Tester |
| :---: | :--- | :--- |
| **200** | OK | Request succeeded with body payload. |
| **201** | Created | Resource successfully created (typically on POST). |
| **204** | No Content | Request succeeded, response body intentionally empty (common on DELETE/PUT). |
| **400** | Bad Request | Client sent invalid payload or missing mandatory parameters. |
| **401** | Unauthorized | Missing, invalid, or expired authentication token. |
| **403** | Forbidden | Valid token, but user lacks permission to access resource (RBAC). |
| **404** | Not Found | Requested endpoint or resource ID does not exist. |
| **409** | Conflict | Conflict in state (e.g., email already registered). |
| **422** | Unprocessable Entity | Payload syntax valid, but business validation failed. |
| **500** | Internal Server Error | Unhandled backend exception / server crash. *(Always log as bug)* |
| **502 / 503** | Bad Gateway / Unavailable | Backend service or database unreachable. |

---

### Core API Testing Checklists for QA
1. **Status Code:** Does response match API specification?
2. **Schema & Types:** Are strings, numbers, booleans, arrays formatted correctly?
3. **Response Time:** Does endpoint resolve in < 500ms under normal load?
4. **Header Validation:** Is \`Content-Type: application/json\` present? Are security headers (\`X-Content-Type-Options\`, \`CORS\`) configured?
5. **Boundary Payloads:** Test empty body, missing required fields, SQL injection strings in JSON fields.
`,
    cheatSheet: [
      { label: "2xx Success", value: "200 OK, 201 Created, 204 No Content", note: "Expected for valid requests" },
      { label: "4xx Client Errors", value: "400 Bad, 401 Unauth, 403 Forbidden, 404 Not Found", note: "Validate user feedback & security" },
      { label: "5xx Server Errors", value: "500 Crash, 502 Bad Gateway, 503 Unavailable", note: "Always file high-severity bug report" },
      { label: "Auth Headers", value: "Authorization: Bearer <token>", note: "Standard JWT bearer authentication" },
    ],
  },
];
