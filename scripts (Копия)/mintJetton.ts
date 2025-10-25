import { toNano, Address } from '@ton/core';
import { MyJetton } from '../build/MyJetton/MyJetton_MyJetton';
import { NetworkProvider } from '@ton/blueprint';
import { getContractAddress } from './utils/contractAddressManager';

// Mint configuration
const MINT_AMOUNT = toNano('1000'); // 1000 tokens
const RECEIVER_ADDRESS = Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'); // Zero address as placeholder

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

    console.log('🪙 Starting jetton minting...');
    console.log('Network:', network);
    console.log('Jetton Address:', jettonAddress);
    console.log('Mint Amount:', MINT_AMOUNT.toString());
    console.log('Receiver:', RECEIVER_ADDRESS.toString());

    // Open jetton contract
    const myJetton = provider.open(MyJetton.fromAddress(Address.parse(jettonAddress)));

    // Send mint transaction
    await myJetton.send(
        provider.sender(),
        {
            value: toNano('0.1'), // Transaction fee
        },
        {
            $$type: 'Mint',
            amount: MINT_AMOUNT,
            receiver: RECEIVER_ADDRESS,
        }
    );

    console.log('📤 Mint transaction sent');
    console.log('✅ Jetton minting completed!');
    console.log(`Minted ${MINT_AMOUNT.toString()} tokens to ${RECEIVER_ADDRESS.toString()}`);
}

// Alternative function for public minting (100 tokens)
export async function runPublicMint(provider: NetworkProvider) {
    // Determine network type
    const network = provider.network() === 'mainnet' ? 'mainnet' : 'testnet';
    
    // Get jetton contract address from deployed contracts
    const jettonAddress = getContractAddress(network, 'MyJetton_MJT');
    
    if (!jettonAddress) {
        console.error('❌ Jetton contract not found in deployed contracts');
        return;
    }

    console.log('🪙 Starting public jetton minting (100 tokens)...');
    console.log('Network:', network);
    console.log('Jetton Address:', jettonAddress);
    console.log('Mint Amount: 100 tokens');

    // Open jetton contract
    const myJetton = provider.open(MyJetton.fromAddress(Address.parse(jettonAddress)));

    // Send public mint transaction
    await myJetton.send(
        provider.sender(),
        {
            value: toNano('0.1'), // Transaction fee
        },
        "Mint: 100"
    );

    console.log('📤 Public mint transaction sent');
    console.log('✅ Public jetton minting completed!');
    console.log('Minted 100 tokens to sender address');
}
