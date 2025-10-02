import { toNano, Address } from '@ton/core';
import { OTC } from '../../build/OTC/OTC_OTC';
import { NetworkProvider } from '@ton/blueprint';
import { getContractAddress } from '../utils/contractAddressManager';

// Configuration constants
const OTC_ID = 1; // OTC contract ID
const DEPOSIT_AMOUNT = toNano('10'); // Amount of TON to deposit

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

    console.log('💰 Starting TON deposit...');
    console.log('Network:', network);
    console.log('OTC Address:', otcAddress);
    console.log('Deposit Amount:', DEPOSIT_AMOUNT.toString());

    // Open OTC contract
    const otc = provider.open(OTC.fromAddress(Address.parse(otcAddress)));

    // Send deposit TON transaction
    await otc.send(
        provider.sender(),
        {
            value: DEPOSIT_AMOUNT + toNano('0.1'), // Deposit amount + transaction fee
        },
        "deposit-ton"
    );

    console.log('📤 Deposit transaction sent');
    console.log('✅ TON deposit completed!');
    console.log(`Deposited ${DEPOSIT_AMOUNT.toString()} TON to OTC contract`);
}
