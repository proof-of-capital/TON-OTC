import { toNano, Address } from '@ton/core';
import { MyJetton } from '../build/MyJetton/MyJetton_MyJetton';
import { NetworkProvider } from '@ton/blueprint';
import { getContractAddress } from './utils/contractAddressManager';

export async function run(provider: NetworkProvider) {
    // Determine network type
    const network = provider.network() === 'mainnet' ? 'mainnet' : 'testnet';
    
    // Get jetton contract address from deployed contracts
    const jettonAddress = getContractAddress(network, 'MyJetton_MJT');
    
    if (!jettonAddress) {
        console.error('❌ Jetton contract not found in deployed contracts');
        console.log('Available contracts:');
        const { getAllContractAddresses } = await import('./utils/contractAddressManager');
        const allContracts = getAllContractAddresses();
        console.log(JSON.stringify(allContracts, null, 2));
        return;
    }

    console.log('🔒 Starting jetton mint closure...');
    console.log('Network:', network);
    console.log('Jetton Address:', jettonAddress);

    // Open jetton contract
    const myJetton = provider.open(MyJetton.fromAddress(Address.parse(jettonAddress)));

    // Send close mint transaction
    await myJetton.send(
        provider.sender(),
        {
            value: toNano('0.1'), // Transaction fee
        },
        "Owner: MintClose"
    );

    console.log('📤 Close mint transaction sent');
    console.log('✅ Jetton minting has been closed!');
    console.log('⚠️  No more tokens can be minted after this transaction');
}
