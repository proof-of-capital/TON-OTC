import { toNano, Address, Cell, beginCell } from '@ton/core';
import { OTC, ProposeFarmAccount, FarmWithdrawData } from '../../build/OTC/OTC_OTC';
import { NetworkProvider } from '@ton/blueprint';
import { getContractAddress } from '../utils/contractAddressManager';

// Configuration constants
const OTC_ID = 5; // OTC contract ID
const QUERY_ID = 12345; // Query ID for the transaction
const FARM_ACCOUNT_ADDRESS = Address.parse('UQBWOZUkRmnEf19c7KKwgY4q7FVjqTtOA19_1-97IiuU1Y_4'); // Zero address as placeholder
const SEND_DATA = 'Hello from OTC!'; // Data to send to farm account

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

    console.log('🏦 Starting farm account proposal...');
    console.log('Network:', network);
    console.log('OTC Address:', otcAddress);
    console.log('Query ID:', QUERY_ID);
    console.log('Farm Account:', FARM_ACCOUNT_ADDRESS.toString());
    console.log('Send Data:', SEND_DATA);
    console.log('⚠️  Only admin can propose farm account');

    // Create send data cell
    const sendDataCell = beginCell()
        .storeBit(0)
        .storeStringTail(SEND_DATA)
        .endCell();

    // Create farm withdraw data
    const farmWithdrawData: FarmWithdrawData = {
        $$type: 'FarmWithdrawData' as const,
        farmAccount: FARM_ACCOUNT_ADDRESS,
        sendData: sendDataCell,
    };

    // Create propose farm account message
    const proposeMessage: ProposeFarmAccount = {
        $$type: 'ProposeFarmAccount' as const,
        queryId: BigInt(QUERY_ID),
        withdrawData: farmWithdrawData,
    };

    // Open OTC contract
    const otc = provider.open(OTC.fromAddress(Address.parse(otcAddress)));

    // Send propose farm account transaction
    await otc.send(
        provider.sender(),
        {
            value: toNano('0.1'), // Transaction fee
        },
        proposeMessage
    );

    console.log('📤 Propose farm account transaction sent');
    console.log('✅ Farm account proposal completed!');
    console.log('Contract state changed to WAITING_FOR_CLIENT_ANSWER');
    console.log('Client can now vote YES or NO on this proposal');
}
