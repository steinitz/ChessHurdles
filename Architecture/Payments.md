# Payment & Credits Architecture

This document covers the strategic roadmap, technical ledger, and operational risks for managing usage and payments in the `stzUser` ecosystem.

## 🗺️ Strategic Roadmap: Usage Control & Payments

We have adopted a phased approach to balance **security (preventing abuse)**, **cost (avoiding AI fees)**, and **legality (tax compliance)**.

### Phase 1: Resource Brakes (Rate Limiting)
**Goal**: Prevent AI cost spikes and database bloat without financial setup.
- **Logic**: Limit non-admin users to **3 analyzed AND saved games per 24 hours**.
- **The "Bot Brake"**: By limiting *saves*, we prevent malicious actors or bots from creating thousands of low-value database entries.
- **Implementation**: A `daily_usage` counter in the user profile or a global `usage_log` table.
- **User UX**: When the limit is hit, the "Analyze" and "Save" actions are disabled with a clear explanation: *"Daily free quota reached (3/3). Wait until tomorrow."*

### Phase 2: Manual Wallet (The "Human MoR")
**Goal**: Allow power users to pay for more usage while avoiding foreign gatekeepers and fees.
- **Logic**: Use the **Universal Credits Ledger** (see below).
- **Payment**: Users pay via **Bank Transfer / PayID** (Australia).
- **Fulfillment**: The admin manually increments the user's credit balance using an internal tool upon receipt of funds.
- **Pros**: 100% revenue retention; zero "scrutiny" from Paddle/LS; no tax automation required for low volumes.

### Phase 3: Automated MoR (Scalability)
**Goal**: Fully automate the revenue and compliance flow.
- **Logic**: Integrate a **Merchant of Record (MoR)** like Paddle or Lemon Squeezy.
- **Fulfillment**: Webhooks handle credit grants automatically.
- **Pros**: Passive income; global tax compliance (VAT/GST) handled by the provider.
- **Cons**: High fees (~5%); rigorous manual website verification.

---

## 🏛 Upstream "Wallet" Architecture (stzUser)
The core architecture remains identical across Phases 2 and 3. The app (ChessHurdles) only talks to the **Universal Wallet API**, ensuring it is provider-agnostic.

### The Generalization Principle
*   **Credits as a Proxy**: Credits represent a generic unit of value (e.g., 1 credit = 1 game analysis).
*   **Service Agnostic**: The ledger tracks atomic balance changes.

### 1. Unified Ledger Schema
We use a transaction ledger for full auditability and idempotency.

```typescript
export interface TransactionTable {
  id: string;             // UUID
  user_id: string;        // FK to user.id
  amount: number;         // Credits (+ve for deposit, -ve for usage)
  type: 'purchase' | 'usage' | 'refund' | 'adjustment' | 'bonus';
  provider: 'lemonsqueezy' | 'paddle' | 'internal';
  provider_ref: string | null; // Unique ID (e.g., Order ID) to prevent double-crediting
  description: string | null;  // Human readable label
  created_at: string;     // ISO Timestamp
}
```

### 2. Provider-Agnostic Interface
```typescript
export const Wallet = {
  async getBalance(userId: string): Promise<number>;
  async recordUsage(userId: string, amount: number, description: string): Promise<void>;
  async grantCredits(userId: string, amount: number, provider: string, ref: string): Promise<void>;
}
```

---

## 🚀 Framework Risks (TanStack Start)

### Serialization & Typing
- **Risk**: Complex provider SDK objects break TanStack Start's serialization.
- **Mitigation**: Never return raw SDK objects from server functions; use custom DTOs for simple strings/numbers.

### Server Function Isolation
- **Risk**: Accidentally importing Node-only SDKs in a client bundle.
- **Mitigation**: Ensure all provider logic is in `.server.ts` or guarded by `server$` wrappers.

---

## 💸 Operational Credits Logic

### Deduction Policy
- **Deduct-on-Success**: Specifically for AI. If the Gemini API fails or triggers a safety filter, the user is not charged.
- **Unit Economics**: Decouple "Credits" from "USD" in the DB, allowing internal costs to be adjusted without changing public dollar prices.

---

## ⚔️ Service Comparison (Phase 3 Reference)

| Provider | Origin | Fees | Verdict |
| :--- | :--- | :--- | :--- |
| **Paddle** | UK (2012) | ~5% | Most stable; highest scrutiny. |
| **Lemon Squeezy** | US (2020) | ~5% | Indie favorite; recently acquired by Stripe. |
| **Dodo Payments** | India (2024)| ~4% | High risk of account closures. Avoid for now. |

### Decision Criteria:
- **Paddle**: Best for long-term B2B stability. Requires a professionalized site.
- **Lemon Squeezy**: Best for rapid Indie setup.