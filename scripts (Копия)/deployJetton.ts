import { toNano, Address, Cell, beginCell } from '@ton/core';
import { MyJetton } from '../build/MyJetton/MyJetton_MyJetton';
import { NetworkProvider } from '@ton/blueprint';
import { addContractAddress } from './utils/contractAddressManager';

// Jetton configuration constants
const JETTON_NAME = 'MyJetton';
const JETTON_SYMBOL = 'MJT';
const JETTON_DECIMALS = 9;
const JETTON_DESCRIPTION = 'My custom jetton for OTC trading';
const MAX_SUPPLY = toNano('1000000'); // 1,000,000 tokens with 9 decimals

// Address constants - using zero address as placeholder
// You should replace this with actual owner address before deployment
const OWNER_ADDRESS = Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'); // Zero address as placeholder

/**
 * Create jetton metadata cell
 * @param name Jetton name
 * @param symbol Jetton symbol
 * @param decimals Number of decimals
 * @param description Jetton description
 * @param image Optional image URL
 * @returns Cell containing jetton metadata
 */
function createJettonMetadata(
    name: string,
    symbol: string,
    decimals: number,
    description: string,
    image?: string
): Cell {
    // Create metadata according to TEP-64 standard
    const metadata = {
        name: name,
        symbol: symbol,
        decimals: decimals.toString(),
        description: description,
        image: image || '',
    };

    // Create off-chain metadata cell
    const metadataCell = beginCell()
        .storeStringTail(JSON.stringify(metadata))
        .endCell();

    // Create content cell with off-chain metadata
    const contentCell = beginCell()
        .storeUint(1, 8) // off-chain content flag
        .storeStringTail('metadata.json') // metadata URI
        .storeRef(metadataCell) // metadata cell
        .endCell();

    return contentCell;
}

export async function run(provider: NetworkProvider) {
    // Determine network type based on provider
    const network = provider.network() === 'mainnet' ? 'mainnet' : 'testnet';
    
    console.log('🚀 Starting jetton deployment...');
    console.log('Network:', network);
    console.log('Owner:', OWNER_ADDRESS.toString());
    console.log('Max Supply:', MAX_SUPPLY.toString());

    // Create jetton metadata
    const jettonContent = createJettonMetadata(
        JETTON_NAME,
        JETTON_SYMBOL,
        JETTON_DECIMALS,
        JETTON_DESCRIPTION
    );

    console.log('📝 Jetton metadata created');

    // Initialize MyJetton contract
    const myJetton = provider.open(await MyJetton.fromInit(
        OWNER_ADDRESS, // owner address
        jettonContent, // content cell with metadata
        MAX_SUPPLY // maximum supply
    ));

    console.log('📋 Jetton contract initialized');
    console.log('Contract address:', myJetton.address.toString());

    // Send deployment transaction
    await myJetton.send(
        provider.sender(),
        {
            value: toNano('0.1'), // Deployment fee
        },
        null,
    );

    console.log('📤 Deployment transaction sent');

    // Wait for contract deployment to complete
    await provider.waitForDeploy(myJetton.address);

    console.log('✅ Jetton contract deployed successfully!');

    // Save contract address to JSON file
    const contractName = `${JETTON_NAME}_${JETTON_SYMBOL}`;
    addContractAddress(network, contractName, myJetton.address);

    // Log deployment information
    console.log('\n📊 Deployment Summary:');
    console.log('─'.repeat(50));
    console.log('Jetton Name:', JETTON_NAME);
    console.log('Jetton Symbol:', JETTON_SYMBOL);
    console.log('Decimals:', JETTON_DECIMALS);
    console.log('Max Supply:', MAX_SUPPLY.toString());
    console.log('Owner Address:', OWNER_ADDRESS.toString());
    console.log('Contract Address:', myJetton.address.toString());
    console.log('Network:', network);
    console.log('Contract saved as:', contractName);
    console.log('─'.repeat(50));

    console.log('\n🎯 Next steps:');
    console.log('1. Mint initial tokens using the owner address');
    console.log('2. Update OTC contract with this jetton address');
    console.log('3. Test jetton functionality');

    return {
        address: myJetton.address,
        name: JETTON_NAME,
        symbol: JETTON_SYMBOL,
        decimals: JETTON_DECIMALS,
        maxSupply: MAX_SUPPLY,
        owner: OWNER_ADDRESS
    };
}
