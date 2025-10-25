import { toNano, Address, beginCell, TupleBuilder, ContractProvider, comment } from '@ton/core';
import { JettonMinter } from '../build/JettonMinter/JettonMinter_JettonMinter';
import { JettonWallet } from '../build/JettonMinter/JettonMinter_JettonWallet';
import { NetworkProvider } from '@ton/blueprint';
import { getContractAddress } from './utils/contractAddressManager';

// Transfer configuration constants
const TRANSFER_AMOUNT = toNano('10'); // Amount of tokens to transfer (100 tokens)
const RECIPIENT_ADDRESS = Address.parse('EQDMfEreVQAcgGD9yYy3dRs4qh8RhwyBkHEVRONwr4ona39X'); // Recipient address (placeholder)
const FORWARD_TON_AMOUNT = toNano('0.1'); // TON amount for forward message
const QUERY_ID = 0n; // Query ID for the transfer

/**
 * Transfer jetton tokens from sender's wallet to recipient
 * All parameters are defined as constants
 */
export async function run(provider: NetworkProvider) {
    // Determine network type
    const network = provider.network() === 'mainnet' ? 'mainnet' : 'testnet';

    // Get jetton contract address from deployed contracts
    const jettonAddress = 'EQBp6FAkDdHD_lLKUBI-J-Et5zQeyJlixc6f3iKHBie85Fd-';

    if (!jettonAddress) {
        console.error('❌ Jetton contract not found in deployed contracts');
        console.log('Available contracts:');
        const { getAllContractAddresses } = await import('./utils/contractAddressManager');
        const allContracts = getAllContractAddresses();
        console.log(JSON.stringify(allContracts, null, 2));
        return;
    }

    console.log('🔄 Starting jetton transfer...');
    console.log('Network:', network);
    console.log('Jetton Address:', jettonAddress);
    console.log('Transfer Amount:', TRANSFER_AMOUNT.toString());
    console.log('Recipient:', RECIPIENT_ADDRESS.toString());
    console.log('Forward TON Amount:', FORWARD_TON_AMOUNT.toString());

    // Open jetton contract to get wallet address
    const jettonMinter = provider.open(JettonMinter.fromAddress(Address.parse(jettonAddress)));

    // Get sender's wallet address using contract provider
    const senderWalletAddress = await jettonMinter.getGetWalletAddress(provider.sender().address!);
    console.log('Sender Wallet Address:', senderWalletAddress.toString());

    const comment = 'Transfer support jetton!';

    // Open sender's jetton wallet
    const senderWallet = provider.open(JettonWallet.fromAddress(senderWalletAddress));
    const forwardPayload = beginCell()
    .storeUint(0x00000000, 32)
    .storeStringTail(comment)
    .endCell();

    // Send transfer transaction using JettonWallet API
    await senderWallet.send(
        provider.sender(),
        {
            value: toNano('0.15'), // Transaction fee
        },
        {
            $$type: 'JettonTransfer',
            queryId: QUERY_ID,
            amount: TRANSFER_AMOUNT,
            destination: RECIPIENT_ADDRESS,
            responseDestination: provider.sender().address!,
            customPayload: null,
            forwardTonAmount: FORWARD_TON_AMOUNT,
            forwardPayload: forwardPayload.asSlice(),
        }
    );

    console.log('📤 Transfer transaction sent');
    console.log('✅ Jetton transfer completed!');
    console.log(`Transferred ${TRANSFER_AMOUNT.toString()} tokens from ${senderWalletAddress.toString()} to ${RECIPIENT_ADDRESS.toString()}`);
}
