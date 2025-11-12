# Private Charity Allocation

Private Charity Allocation is a privacy-preserving application that leverages Zama's FHE technology to ensure the confidentiality of donation distributions. By employing Fully Homomorphic Encryption (FHE), our system enables the secure allocation of funds based on the encrypted needs of beneficiaries, preserving their privacy and dignity throughout the process.

## The Problem

In traditional charitable models, sensitive data regarding beneficiaries' needs often requires exposure in cleartext for proper fund allocation. This poses significant privacy and security risks, as malicious actors may exploit this information for fraudulent claims or other unethical purposes. The risk of data breaches can undermine the trust of beneficiaries and donors alike, ultimately impacting the effectiveness of charitable initiatives.

## The Zama FHE Solution

Zama's FHE technology provides an innovative solution by enabling computation on encrypted data. This means that our allocation algorithms can process beneficiary needs without ever decrypting their sensitive information. By using Zama’s advanced libraries, we can perform complex calculations directly on encrypted inputs, offering a secure and reliable method of fund allocation that upholds the privacy of all parties involved.

## Key Features

- 🛡️ **Privacy Protection**: Maintain the confidentiality of beneficiaries' sensitive data at all times.
- ⚖️ **Fair Distribution**: Utilize advanced algorithms to ensure equitable allocation based on encrypted data.
- 💡 **Precise Poverty Alleviation**: Target aid more effectively by addressing the specific needs of beneficiaries without compromising their dignity.
- 🤝 **Transparency for Donors**: Provide donors with encrypted reports on fund distributions while keeping beneficiary identities private.

## Technical Architecture & Stack

Our application is built to leverage cutting-edge technology, with its core privacy engine powered by Zama's libraries. The technical stack includes:

- **Backend**: Zama's fhevm for secure computations.
- **Frontend**: Custom-built user interface to facilitate donation and distribution processes.
- **Database**: Encrypted databases to store beneficiary and donation data securely.

## Smart Contract / Core Logic

Below is a simplified example of how the core logic makes use of Zama's FHE functionality within a smart contract environment. The code demonstrates how encrypted data can be utilized to allocate charity funds based on wishes expressed by beneficiaries.

```solidity
pragma solidity ^0.8.0;

import "tfhe.rs"; // Hypothetical import for demonstration

contract CharityAllocation {
    struct Beneficiary {
        uint64 encryptedNeed;
    }

    mapping(address => Beneficiary) public beneficiaries;

    function allocateFunds(address beneficiaryAddress, uint64 fundAmount) public {
        uint64 encryptedAllocation = TFHE.add(beneficiaries[beneficiaryAddress].encryptedNeed, fundAmount);
        TFHE.decrypt(encryptedAllocation); // For illustration purposes
        // Allocated funds logic here
    }
}
```

## Directory Structure

Here’s how the project is organized:

```
/private-charity-allocation
├── .sol
│   └── CharityAllocation.sol
├── backend
│   ├── allocation_algorithm.py
│   └── encrypted_storage.py
└── frontend
    ├── index.html
    └── app.js
```

## Installation & Setup

To get started with Private Charity Allocation, follow these steps:

### Prerequisites

1. Ensure you have Node.js and npm installed for the frontend.
2. For the backend, ensure that Python and pip are available on your machine.

### Installing Dependencies

Run the following commands to install the necessary dependencies:

For Node.js dependencies, navigate to the frontend directory:

```bash
npm install
```

For the backend dependencies, navigate to the backend directory:

```bash
pip install concrete-ml
```

This installs the Zama library required for our privacy-preserving computations.

## Build & Run

Once you have installed all the dependencies, you can build and run the application using the following commands:

### Frontend

To start the frontend, simply run:

```bash
npx serve
```

This will host the application locally.

### Backend

To execute the backend logic, run:

```bash
python main.py
```

This command will initiate the backend processes necessary for the fund allocation logic.

## Acknowledgements

We would like to express our gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their commitment to privacy-preserving technologies enables us to deliver a solution that not only honors the confidentiality of beneficiaries but also maximizes the impact of charitable donations.

```
This documentation provides an overview of the Private Charity Allocation application and outlines how Zama's cutting-edge FHE technology is utilized to improve privacy in charitable distributions. We are committed to fostering a secure and compassionate approach to philanthropy, ensuring that the needs of the vulnerable are addressed without compromising their dignity.

