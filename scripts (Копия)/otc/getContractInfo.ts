import { Address } from '@ton/core';
import { OTC } from '../../build/OTC/OTC_OTC';
import { NetworkProvider } from '@ton/blueprint';
import { getContractAddress } from '../utils/contractAddressManager';

// Configuration constants
const OTC_ID = 1; // OTC contract ID

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

    console.log('📊 Getting OTC contract information...');
    console.log('Network:', network);
    console.log('OTC Address:', otcAddress);
    console.log('─'.repeat(60));

    // Open OTC contract
    const otc = provider.open(OTC.fromAddress(Address.parse(otcAddress)));

    try {
        // Get contract information
        const contractId = await otc.getContractId();
        const inputTokenMaster = await otc.getInputTokenMaster();
        const outputTokenMaster = await otc.getOutputTokenMaster();
        const inputWallet = await otc.getInputWallet();
        const outputWallet = await otc.getOutputWallet();
        const adminAddress = await otc.getAdminAddress();
        const clientAddress = await otc.getClientAddress();
        const tonBalance = await otc.getTonBalanceAmount();
        const outputTokenBalance = await otc.getOutputTokenBalanceAmount();
        const supplyCount = await otc.getSupplyCountValue();
        const currentSupplyIndex = await otc.getCurrentSupplyIndex();
        const refundPrice = await otc.getRefundPrice();
        const minInputAmount = await otc.getMinInputAmountValue();
        const minOutputAmount = await otc.getMinOutputAmount();
        const supplyLockEndTime = await otc.getSupplyLockEndTime();
        const totalLockEndTime = await otc.getTotalLockEndTime();
        const buybackPrice = await otc.getBuybackPrice();
        const currentState = await otc.getCurrentState();
        const withdrawDataInfo = await otc.getWithdrawDataInfo();
        const proposedTime = await otc.getProposedTime();
        const balance = await otc.getBalance();

        // Display contract information
        console.log('📋 Contract Information:');
        console.log('─'.repeat(60));
        console.log('Contract ID:', contractId.toString());
        console.log('Contract Balance:', balance.toString(), 'nanoTON');
        console.log('Current State:', getStateName(currentState));
        console.log('');
        
        console.log('🔗 Token Information:');
        console.log('─'.repeat(60));
        console.log('Input Token Master:', inputTokenMaster.toString());
        console.log('Output Token Master:', outputTokenMaster.toString());
        console.log('Input Wallet:', inputWallet.toString());
        console.log('Output Wallet:', outputWallet.toString());
        console.log('');
        
        console.log('👥 Address Information:');
        console.log('─'.repeat(60));
        console.log('Admin Address:', adminAddress.toString());
        console.log('Client Address:', clientAddress.toString());
        console.log('');
        
        console.log('💰 Balance Information:');
        console.log('─'.repeat(60));
        console.log('TON Balance:', tonBalance.toString(), 'nanoTON');
        console.log('Output Token Balance:', outputTokenBalance.toString(), 'tokens');
        console.log('');
        
        console.log('⚙️ Supply Information:');
        console.log('─'.repeat(60));
        console.log('Supply Count:', supplyCount.toString());
        console.log('Current Supply Index:', currentSupplyIndex.toString());
        console.log('Min Input Amount:', minInputAmount.toString(), 'nanoTON');
        console.log('Min Output Amount:', minOutputAmount.toString(), 'tokens');
        console.log('');
        
        console.log('🔒 Lock Information:');
        console.log('─'.repeat(60));
        console.log('Supply Lock End Time:', new Date(Number(supplyLockEndTime) * 1000).toISOString());
        console.log('Total Lock End Time:', new Date(Number(totalLockEndTime) * 1000).toISOString());
        console.log('');
        
        console.log('💲 Price Information:');
        console.log('─'.repeat(60));
        console.log('Refund Price:', refundPrice.toString(), 'nanoTON');
        console.log('Buyback Price:', buybackPrice.toString(), 'nanoTON');
        console.log('');
        
        if (withdrawDataInfo) {
            console.log('🏦 Withdraw Data:');
            console.log('─'.repeat(60));
            console.log('Farm Account:', withdrawDataInfo.farmAccount.toString());
            console.log('Send Data:', withdrawDataInfo.sendData.toString());
            console.log('');
        }
        
        if (proposedTime) {
            console.log('⏰ Proposal Information:');
            console.log('─'.repeat(60));
            console.log('Proposed Time:', new Date(Number(proposedTime) * 1000).toISOString());
            console.log('');
        }

    } catch (error) {
        console.error('❌ Error getting contract information:', error);
    }
}

// Helper function to get state name
function getStateName(state: bigint): string {
    const states: { [key: number]: string } = {
        0: 'FUNDING',
        1: 'SUPPLY_IN_PROGRESS', 
        2: 'SUPPLY_PROVIDED',
        3: 'WAITING_FOR_CLIENT_ANSWER',
        4: 'CLIENT_ACCEPTED',
        5: 'CLIENT_REJECTED',
        6: 'CANCELED'
    };
    return states[Number(state)] || `UNKNOWN (${state})`;
}
