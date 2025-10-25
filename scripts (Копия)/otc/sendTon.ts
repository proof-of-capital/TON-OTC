import { toNano, Address } from '@ton/core';
import { OTC } from '../../build/OTC/OTC_OTC';
import { NetworkProvider } from '@ton/blueprint';
import { getContractAddress } from '../utils/contractAddressManager';

// Configuration constants
const OTC_ID = 1; // OTC contract ID
const SEND_AMOUNT = toNano('0.5'); // Amount of TON to send to contract

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

    console.log('💸 Starting TON send to contract...');
    console.log('Network:', network);
    console.log('OTC Address:', otcAddress);
    console.log('Send Amount:', SEND_AMOUNT.toString());
    console.log('ℹ️  This will trigger the receive() function');

    // Open OTC contract
    const otc = provider.open(OTC.fromAddress(Address.parse(otcAddress)));

    // Send TON to contract (triggers receive() function)
    await otc.send(
        provider.sender(),
        {
            value: SEND_AMOUNT, // Amount to send
        },
        null // No message body - triggers receive()
    );

    console.log('📤 TON send transaction sent');
    console.log('✅ TON send completed!');
    console.log(`Sent ${SEND_AMOUNT.toString()} TON to OTC contract`);
    console.log('Contract will forward remaining balance to admin');
}
