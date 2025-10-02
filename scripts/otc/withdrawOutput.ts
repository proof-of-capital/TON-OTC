import { toNano, Address } from '@ton/core';
import { OTC, WithdrawOutput } from '../../build/OTC/OTC_OTC';
import { NetworkProvider } from '@ton/blueprint';
import { getContractAddress } from '../utils/contractAddressManager';

// Configuration constants
const OTC_ID = 1; // OTC contract ID
const QUERY_ID = 12345; // Query ID for the transaction
const WITHDRAW_AMOUNT = toNano('1000'); // Amount of output tokens to withdraw

export async function run(provider: NetworkProvider) {
    // Determine network type
    const network = provider.network() === 'mainnet' ? 'mainnet' : 'testnet';
    
    // Get OTC contract address from deployed contracts
    const contractName = `OTC_${OTC_ID}`;
    const otcAddress = getContractAddress(network, contractName);
    
    if (!otcAddress) {
        console.error('❌ OTC contract not found in deployed contracts');
        console.log('Available contracts:');
        const { getAllContractAddresses } = await import('../utils/contractAddressManager');
        const allContracts = getAllContractAddresses();
        console.log(JSON.stringify(allContracts, null, 2));
        return;
    }

    console.log('💸 Starting output token withdrawal...');
    console.log('Network:', network);
    console.log('OTC Address:', otcAddress);
    console.log('Query ID:', QUERY_ID);
    console.log('Withdraw Amount:', WITHDRAW_AMOUNT.toString());
    console.log('⚠️  Only client can withdraw output tokens');

    // Open OTC contract
    const otc = provider.open(OTC.fromAddress(Address.parse(otcAddress)));

    // Create withdraw output message
    const withdrawMessage: WithdrawOutput = {
        $$type: 'WithdrawOutput' as const,
        queryId: BigInt(QUERY_ID),
        amount: WITHDRAW_AMOUNT,
    };

    // Send withdraw output transaction
    await otc.send(
        provider.sender(),
        {
            value: toNano('0.1'), // Transaction fee
        },
        withdrawMessage
    );

    console.log('📤 Withdraw output transaction sent');
    console.log('✅ Output token withdrawal completed!');
    console.log(`Withdrew ${WITHDRAW_AMOUNT.toString()} output tokens to client address`);
    console.log('⚠️  This will set the contract state to CANCELED');
}
