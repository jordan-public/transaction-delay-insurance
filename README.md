# Transaction Delay Insurance

## Abstract

This project provides a solution for mitigating the inconvenience and financial loss caused by transaction delays in Ethereum Virtual Machine (EVM) networks. It introduces a smart contract that acts as an insurance provider, allowing users to reclaim losses incurred due to delays without modifying their original transactions. The solution also uses an RPC proxy to record proof of transaction delays, enabling efficient claim processing.

## Introduction

EVM Transaction Delay can cause inconvenience and/or financial loss. One way to mitigate this problem
is to increase the Gas Priority Fee allowance when broadcasting the transaction. However, even this does not help with Zircuit, which has the ability to quarantine transactions upon suspicion of misbehavior as determined by their AI models.

This project aims to create a solution that provides insurance against transaction delays, allowing users to reclaim their losses in case of delayed transactions.

Modifying the original transaction can be a great inconvenience, especially if the code is not owned
by the sender.

## Solution

This solution involves creating a smart contract that acts as an insurance provider for transactions. The contract will allow users to purchase insurance for their transactions, which will cover losses incurred due to transaction delays.

In order to avoid modifying the original transaction, we provide a proxy RPC, which records the timestamps / block number when the transaction is broadcast and executed. This proxy signs the interaction, so it can be used as a proof of transaction delay when claiming the insurance payout.

We have considered direct interaction with the original RPC services and using TLS Notary in order to
obtain proofs of interaction and timestamps. While such alternative implementation would be completely trustless, it would introduce extra cost and transaction delays in order to create the ZK proofs,
which would defeat the goal of mitigating delays.

## Design

### System Architecture

The Transaction Delay Insurance system consists of three main components:
1. **Insurance Smart Contract** - Handles policy purchases, claims, and payouts
2. **RPC Proxy** - Records transaction timestamps and provides delay proofs
3. **User Interface** - Allows users to interact with the system

### Interaction Diagrams

#### 1. Insurance Policy Purchase Flow

<div class="mermaid">
```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Insurance Contract
    participant RPC Proxy

    User->>UI: Request insurance quote
    UI->>Insurance Contract: getQuote(txHash, coverage, duration)
    Insurance Contract-->>UI: premium amount
    UI-->>User: Display quote
    User->>UI: Purchase insurance
    UI->>Insurance Contract: purchaseInsurance(txHash, coverage) + premium
    Insurance Contract->>Insurance Contract: Create policy
    Insurance Contract-->>UI: Policy ID
    UI-->>User: Insurance confirmation
```
</div>

#### 2. Transaction Broadcasting with Delay Tracking

```mermaid
sequenceDiagram
    participant User
    participant RPC Proxy
    participant Blockchain Network
    participant Insurance Contract

    User->>RPC Proxy: Submit transaction
    RPC Proxy->>RPC Proxy: Record submission timestamp
    RPC Proxy->>Blockchain Network: Broadcast transaction
    RPC Proxy->>RPC Proxy: Sign delay proof
    
    alt Transaction executed quickly
        Blockchain Network-->>RPC Proxy: Transaction confirmed
        RPC Proxy->>RPC Proxy: Record execution timestamp
        RPC Proxy-->>User: Success response
    else Transaction delayed
        Note over Blockchain Network: Transaction pending/quarantined
        RPC Proxy->>RPC Proxy: Monitor for execution
        RPC Proxy->>Insurance Contract: Record delay evidence
    end
```

#### 3. Insurance Claim Processing Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Insurance Contract
    participant RPC Proxy
    participant Oracle/Verifier

    User->>UI: Submit claim for delayed transaction
    UI->>Insurance Contract: submitClaim(policyId, txHash)
    Insurance Contract->>RPC Proxy: Request delay proof
    RPC Proxy-->>Insurance Contract: Signed delay evidence
    Insurance Contract->>Oracle/Verifier: Verify delay proof
    Oracle/Verifier-->>Insurance Contract: Validation result
    
    alt Valid claim
        Insurance Contract->>Insurance Contract: Calculate payout
        Insurance Contract->>User: Transfer payout
        Insurance Contract-->>UI: Claim approved
    else Invalid claim
        Insurance Contract-->>UI: Claim rejected
    end
    
    UI-->>User: Claim result
```

#### 4. Complete User Journey

```mermaid
graph TD
    A[User wants to send transaction] --> B[Purchase insurance policy]
    B --> C[Submit transaction via RPC Proxy]
    C --> D{Transaction executed on time?}
    D -->|Yes| E[Transaction successful, no claim needed]
    D -->|No| F[Transaction delayed/failed]
    F --> G[Submit insurance claim]
    G --> H[RPC Proxy provides delay proof]
    H --> I[Insurance contract verifies claim]
    I --> J{Valid claim?}
    J -->|Yes| K[Receive insurance payout]
    J -->|No| L[Claim rejected]
```

### Component Interactions

#### RPC Proxy Responsibilities
- Record transaction submission timestamps
- Monitor transaction execution
- Generate cryptographic proofs of delays
- Provide signed attestations for claims

#### Insurance Contract Responsibilities
- Manage policy purchases and premiums
- Validate delay proofs from RPC Proxy
- Calculate and distribute payouts
- Maintain policy and claim records

#### Verification Process
- Timestamp validation against blockchain data
- Signature verification of RPC Proxy attestations
- Delay threshold validation based on policy terms
- Financial loss calculation and payout determination

## Implementation


## Future Work