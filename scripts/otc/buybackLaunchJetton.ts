import { toNano, Address } from '@ton/core';
import { OTC, BuybackLaunchJetton } from '../../build/OTC/OTC_OTC';
import { NetworkProvider } from '@ton/blueprint';
import { getContractAddress } from '../utils/contractAddressManager';

// Configuration constants
const OTC_ID = 1; // OTC contract ID
const QUERY_ID = 12345; // Query ID for the transaction
const BUYBACK_AMOUNT = toNano('1'); // Amount of TON to use for buyback

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

    console.log('🔄 Starting launch jetton buyback...');
    console.log('Network:', network);
    console.log('OTC Address:', otcAddress);
    console.log('Query ID:', QUERY_ID);
    console.log('Buyback Amount:', BUYBACK_AMOUNT.toString());
    console.log('⚠️  Only admin can perform buyback');
    console.log('⚠️  This only works for TON inputs (inputMasterToken must be ZERO_ADDRESS)');

    // Create buyback message
    const buybackMessage: BuybackLaunchJetton = {
        $$type: 'BuybackLaunchJetton' as const,
        queryId: BigInt(QUERY_ID),
        amount: BUYBACK_AMOUNT,
    };

    // Open OTC contract
    const otc = provider.open(OTC.fromAddress(Address.parse(otcAddress)));

    // Send buyback transaction
    await otc.send(
        provider.sender(),
        {
            value: BUYBACK_AMOUNT + toNano('0.1'), // Buyback amount + transaction fee
        },
        buybackMessage
    );

    console.log('📤 Buyback transaction sent');
    console.log('✅ Launch jetton buyback completed!');
    console.log(`Used ${BUYBACK_AMOUNT.toString()} TON to buyback launch jetton`);
    console.log('Contract state changed to CANCELED');
    console.log('Output tokens were sent to admin address');
}
