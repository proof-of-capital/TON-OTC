import { Address } from "@ton/core";
// Helper function to verify transactions don't have failures
export async function verifyTransactions(transactions: any, fromAddress: Address) {
    expect(transactions).not.toHaveTransaction({
        success: false,
        to: (a?: Address) => a?.toString() !== fromAddress.toString(),
    });
}
