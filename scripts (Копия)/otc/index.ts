import { NetworkProvider } from '@ton/blueprint';

// Import all OTC scripts
import { run as depositTon } from './depositTon';
import { run as checkInput } from './checkInput';
import { run as checkOutput } from './checkOutput';
import { run as withdrawTon } from './withdrawTon';
import { run as clientVoteYes } from './clientVoteYes';
import { run as clientVoteNo } from './clientVoteNo';
import { run as depositTonWithAmount } from './depositTonWithAmount';
import { run as withdrawInput } from './withdrawInput';
import { run as withdrawOutput } from './withdrawOutput';
import { run as proposeFarmAccount } from './proposeFarmAccount';
import { run as send } from './send';
import { run as buybackLaunchJetton } from './buybackLaunchJetton';
import { run as sendTon } from './sendTon';
import { run as getContractInfo } from './getContractInfo';

// Available OTC operations
const OTC_OPERATIONS = {
    // Simple operations
    'deposit-ton': depositTon,
    'check-input': checkInput,
    'check-output': checkOutput,
    'withdraw-ton': withdrawTon,
    'client-vote-yes': clientVoteYes,
    'client-vote-no': clientVoteNo,
    'send-ton': sendTon,
    'get-info': getContractInfo,
    
    // Operations with parameters
    'deposit-ton-amount': depositTonWithAmount,
    'withdraw-input': withdrawInput,
    'withdraw-output': withdrawOutput,
    'propose-farm': proposeFarmAccount,
    'send': send,
    'buyback': buybackLaunchJetton,
};

export async function run(provider: NetworkProvider) {
    const args = process.argv.slice(2);
    const operation = args[0];

    if (!operation) {
        console.log('🚀 OTC Contract Operations');
        console.log('─'.repeat(50));
        console.log('Usage: npx blueprint run otc <operation>');
        console.log('');
        console.log('Available operations:');
        console.log('');
        console.log('📋 Simple Operations:');
        console.log('  deposit-ton          - Deposit TON to contract');
        console.log('  check-input          - Check input tokens availability');
        console.log('  check-output         - Check output tokens availability');
        console.log('  withdraw-ton         - Withdraw TON (client only)');
        console.log('  client-vote-yes      - Client vote YES on proposal');
        console.log('  client-vote-no       - Client vote NO on proposal');
        console.log('  send-ton             - Send TON to contract (triggers receive)');
        console.log('  get-info             - Get contract information');
        console.log('');
        console.log('⚙️ Operations with Parameters:');
        console.log('  deposit-ton-amount   - Deposit specific TON amount');
        console.log('  withdraw-input       - Withdraw input tokens (client only)');
        console.log('  withdraw-output      - Withdraw output tokens (client only)');
        console.log('  propose-farm         - Propose farm account (admin only)');
        console.log('  send                 - Send tokens to farm account (admin only)');
        console.log('  buyback              - Buyback launch jetton (admin only)');
        console.log('');
        console.log('Examples:');
        console.log('  npx blueprint run otc deposit-ton');
        console.log('  npx blueprint run otc get-info');
        console.log('  npx blueprint run otc client-vote-yes');
        return;
    }

    const operationFunction = OTC_OPERATIONS[operation as keyof typeof OTC_OPERATIONS];
    
    if (!operationFunction) {
        console.error(`❌ Unknown operation: ${operation}`);
        console.log('Run without arguments to see available operations');
        return;
    }

    try {
        console.log(`🚀 Running OTC operation: ${operation}`);
        console.log('─'.repeat(50));
        await operationFunction(provider);
    } catch (error) {
        console.error(`❌ Error running operation ${operation}:`, error);
    }
}
