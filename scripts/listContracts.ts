import { getAllContractAddresses, listContractsForNetwork } from './utils/contractAddressManager';

/**
 * List all deployed contracts across all networks
 */
export function listAllContracts() {
    const allContracts = getAllContractAddresses();
    
    console.log('=== Deployed Contracts ===\n');
    
    Object.keys(allContracts).forEach(network => {
        const contracts = listContractsForNetwork(network);
        console.log(`Network: ${network.toUpperCase()}`);
        console.log('─'.repeat(50));
        
        if (Object.keys(contracts).length === 0) {
            console.log('  No contracts deployed\n');
        } else {
            Object.entries(contracts).forEach(([contractName, address]) => {
                console.log(`  ${contractName}: ${address}`);
            });
            console.log('');
        }
    });
}

/**
 * List contracts for a specific network
 * @param network Network name (mainnet or testnet)
 */
export function listContractsForSpecificNetwork(network: string) {
    const contracts = listContractsForNetwork(network);
    
    console.log(`=== Contracts on ${network.toUpperCase()} ===\n`);
    
    if (Object.keys(contracts).length === 0) {
        console.log('No contracts deployed on this network');
    } else {
        Object.entries(contracts).forEach(([contractName, address]) => {
            console.log(`${contractName}: ${address}`);
        });
    }
}

// Run if this script is executed directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const network = args[0];
    
    if (network) {
        listContractsForSpecificNetwork(network);
    } else {
        listAllContracts();
    }
}
