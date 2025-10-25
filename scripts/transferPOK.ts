import { toNano, Address, beginCell, TupleBuilder, ContractProvider } from '@ton/core';
import { MyJetton, TokenTransfer, storeTokenTransfer } from '../build/MyJetton/MyJetton_MyJetton';
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
    const myJetton = provider.open(MyJetton.fromAddress(Address.parse(jettonAddress)));

    // Get sender's wallet address using contract provider
    const senderWalletAddress = await myJetton.getGetWalletAddress(provider.sender().address!);
    console.log('Sender Wallet Address:', senderWalletAddress.toString());

    const comment = 'Transfer support jetton!';

    const forwardPayload = beginCell()
    .storeUint(0x00000000, 32)
    .storeStringTail(comment)
    .endCell();

    // Create TokenTransfer message using the contract's type
    const transferMessage: TokenTransfer = {
        $$type: 'TokenTransfer',
        query_id: QUERY_ID,
        amount: TRANSFER_AMOUNT,
        recipient: RECIPIENT_ADDRESS,
        response_destination: provider.sender().address!,
        custom_payload: null,
        forward_ton_amount: FORWARD_TON_AMOUNT,
        forward_payload: forwardPayload.asSlice(), // Empty slice
    };

    // Create the transfer message body using the contract's serializer
    const transferBody = beginCell()
        .store(storeTokenTransfer(transferMessage))
        .endCell();

    // Send transfer transaction to sender's jetton wallet
    await provider.sender().send({
        to: senderWalletAddress,
        value: toNano('0.15'), // Transaction fee
        body: transferBody,
    });

    console.log('📤 Transfer transaction sent');
    console.log('✅ Jetton transfer completed!');
    console.log(`Transferred ${TRANSFER_AMOUNT.toString()} tokens from ${senderWalletAddress.toString()} to ${RECIPIENT_ADDRESS.toString()}`);
}
