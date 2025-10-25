import { toNano, Address } from '@ton/core';
import { OTC } from '../../build/OTC/OTC_OTC';
import { NetworkProvider } from '@ton/blueprint';
import { getContractAddress } from '../utils/contractAddressManager';

// Configuration constants
const OTC_ID = 1; // OTC contract ID
const MIN_CHECK_AMOUNT = toNano('0.1'); // Minimum amount for check operation

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

    console.log('🔍 Starting output check...');
    console.log('Network:', network);
    console.log('OTC Address:', otcAddress);
    console.log('Check Amount:', MIN_CHECK_AMOUNT.toString());

    // Open OTC contract
    const otc = provider.open(OTC.fromAddress(Address.parse(otcAddress)));

    // Send check output transaction
    await otc.send(
        provider.sender(),
        {
            value: MIN_CHECK_AMOUNT, // Transaction fee
        },
        "check-output"
    );

    console.log('📤 Check output transaction sent');
    console.log('✅ Output check completed!');
    console.log('This will check if output tokens are available and set output balance');
}
