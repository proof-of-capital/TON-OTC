import { Address } from '@ton/core';
import * as fs from 'fs';
import * as path from 'path';

// Interface for contract address storage structure
interface ContractAddresses {
    [network: string]: {
        [contractName: string]: string;
    };
}

// Path to the deployed contracts JSON file
const CONTRACTS_FILE_PATH = path.join(__dirname, '../../deployed-contracts.json');

/**
 * Read contract addresses from JSON file
 * @returns ContractAddresses object
 */
export function readContractAddresses(): ContractAddresses {
    try {
        if (!fs.existsSync(CONTRACTS_FILE_PATH)) {
            // Create empty structure if file doesn't exist
            const emptyStructure: ContractAddresses = {
                mainnet: {},
                testnet: {}
            };
            writeContractAddresses(emptyStructure);
            return emptyStructure;
        }
        
        const fileContent = fs.readFileSync(CONTRACTS_FILE_PATH, 'utf8');
        return JSON.parse(fileContent) as ContractAddresses;
    } catch (error) {
        console.error('Error reading contract addresses:', error);
        return { mainnet: {}, testnet: {} };
    }
}

/**
 * Write contract addresses to JSON file
 * @param addresses ContractAddresses object to write
 */
export function writeContractAddresses(addresses: ContractAddresses): void {
    try {
        const dir = path.dirname(CONTRACTS_FILE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(CONTRACTS_FILE_PATH, JSON.stringify(addresses, null, 2));
    } catch (error) {
        console.error('Error writing contract addresses:', error);
    }
}

/**
 * Add or update a contract address
 * @param network Network name (e.g., 'mainnet', 'testnet')
 * @param contractName Name of the contract
 * @param address Contract address
 */
export function addContractAddress(network: string, contractName: string, address: Address | string): void {
    const addresses = readContractAddresses();
    
    // Ensure network exists
    if (!addresses[network]) {
        addresses[network] = {};
    }
    
    // Add or update contract address
    addresses[network][contractName] = address.toString();
    
    writeContractAddresses(addresses);
    console.log(`Contract address saved: ${network}/${contractName} = ${address.toString()}`);
}

/**
 * Get contract address by network and contract name
 * @param network Network name
 * @param contractName Contract name
 * @returns Contract address as string or undefined if not found
 */
export function getContractAddress(network: string, contractName: string): string | undefined {
    const addresses = readContractAddresses();
    return addresses[network]?.[contractName];
}

/**
 * List all contracts for a specific network
 * @param network Network name
 * @returns Object with contract names and addresses
 */
export function listContractsForNetwork(network: string): { [contractName: string]: string } {
    const addresses = readContractAddresses();
    return addresses[network] || {};
}

/**
 * Get all networks and their contracts
 * @returns Complete ContractAddresses object
 */
export function getAllContractAddresses(): ContractAddresses {
    return readContractAddresses();
}
