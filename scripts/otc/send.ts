import { toNano, Address } from '@ton/core';
import { OTC, Send } from '../../build/OTC/OTC_OTC';
import { NetworkProvider } from '@ton/blueprint';
import { getContractAddress } from '../utils/contractAddressManager';

// Configuration constants
const OTC_ID = 1; // OTC contract ID
const QUERY_ID = 12345; // Query ID for the transaction
const FORWARD_TON_AMOUNT = toNano('0.1'); // TON amount to forward with the transaction

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

    console.log('📤 Starting send operation...');
    console.log('Network:', network);
    console.log('OTC Address:', otcAddress);
    console.log('Query ID:', QUERY_ID);
    console.log('Forward TON Amount:', FORWARD_TON_AMOUNT.toString());
    console.log('⚠️  Only admin can send, and client must have accepted the proposal');

    // Create send message
    const sendMessage: Send = {
        $$type: 'Send' as const,
        queryId: BigInt(QUERY_ID),
        forwardTonAmount: FORWARD_TON_AMOUNT,
    };

    // Open OTC contract
    const otc = provider.open(OTC.fromAddress(Address.parse(otcAddress)));

    // Send send transaction
    await otc.send(
        provider.sender(),
        {
            value: toNano('0.1'), // Transaction fee
        },
        sendMessage
    );

    console.log('📤 Send transaction sent');
    console.log('✅ Send operation completed!');
    console.log(`Sent output tokens to farm account with ${FORWARD_TON_AMOUNT.toString()} TON`);
    console.log('This will transfer the minimum output amount to the proposed farm account');
}
