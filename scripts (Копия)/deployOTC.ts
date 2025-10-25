import { toNano, Address, Dictionary } from '@ton/core';
import { OTC, Supply, dictValueParserSupply } from '../build/OTC/OTC_OTC';
import { NetworkProvider } from '@ton/blueprint';
import { addContractAddress } from './utils/contractAddressManager';

// Define meaningful constants for OTC initialization
const OTC_ID = 2n;
const PRICE_TO_REFUND = toNano('0.0000055'); // 0.1 TON for refund


// Supply constants for the OTC contract
const SUPPLY_DATA = [
    {
        input: toNano('0.00005'), // 10 tokens input
        output: toNano('10'), // 100 tokens output
    },
    {
        input: toNano('0.00006'), // 10 tokens input
        output: toNano('10'), // 100 tokens output
    }
];

// Address constants - using zero address as placeholder
// You should replace these with actual addresses before deployment
const SUPPLY_JETTON_ADDRESS = Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'); // Zero address as placeholder
const LAUNCH_JETTON_ADDRESS = Address.parse('EQBp6FAkDdHD_lLKUBI-J-Et5zQeyJlixc6f3iKHBie85Fd-'); // Zero address as placeholder
const DEPLOYER_ADDRESS = Address.parse('EQBWOZUkRmnEf19c7KKwgY4q7FVjqTtOA19_1-97IiuU1dI9'); // Zero address as placeholder
const CLIENT_ADDRESS = Address.parse('UQCzRubciSKFgpT9Oa9CBpOit-twuSI2IczOt0rgx9MEkimT'); // Zero address as placeholder

export async function run(provider: NetworkProvider) {
    // Determine network type based on provider
    const network = provider.network() === 'mainnet' ? 'mainnet' : 'testnet';

    // Create supply dictionary with proper Supply structure using dictValueParserSupply
    const supplyDictionary = Dictionary.empty(Dictionary.Keys.Uint(32), dictValueParserSupply());

    // Create Supply objects array for the OTC contract
    const supplies: Supply[] = SUPPLY_DATA.map(data => ({
        $$type: 'Supply' as const,
        input: data.input,
        output: data.output,
    }));

    // const supplies: Supply[] = [];

    // Add supplies to dictionary with their respective indices
    supplies.forEach((supply, index) => {
        supplyDictionary.set(index, supply);
    });

    // // Calculate totals from array
    const totalOutputAmount = supplies.reduce((sum, supply) => sum + supply.output, 0n);
    const totalInputAmount = supplies.reduce((sum, supply) => sum + supply.input, 0n);
    // const totalInputAmount = toNano('0');
    // const totalOutputAmount = toNano('10');



    // Initialize OTC contract with all required parameters
    const oTC = provider.open(await OTC.fromInit(
        OTC_ID, // Unique identifier for the OTC contract
        SUPPLY_JETTON_ADDRESS, // Address of the supply jetton contract
        LAUNCH_JETTON_ADDRESS, // Address of the launch jetton contract
        DEPLOYER_ADDRESS, // Address of the deployer/owner
        CLIENT_ADDRESS, // Address of the client
        supplyDictionary, // Dictionary containing supply information
        PRICE_TO_REFUND, // Price for refund operations
        totalOutputAmount, // Total output amount available
        totalInputAmount, // Total input amount required
        true, // Contract is active
    ));

    // Send deployment transaction
    await oTC.send(
        provider.sender(),
        {
            value: toNano('0.2'), // Deployment fee
        },
        null,
    );

    // Wait for contract deployment to complete
    await provider.waitForDeploy(oTC.address);

    // Save contract address to JSON file
    const contractName = `OTC_${OTC_ID}`;
    addContractAddress(network, contractName, oTC.address);

    // Log deployment information
    console.log('OTC contract deployed at:', oTC.address.toString());
    console.log('Network:', network);
    console.log('Contract saved as:', contractName);
    console.log('OTC ID:', OTC_ID);
    console.log('Supply Jetton Address:', SUPPLY_JETTON_ADDRESS.toString());
    console.log('Launch Jetton Address:', LAUNCH_JETTON_ADDRESS.toString());
    console.log('Deployer Address:', DEPLOYER_ADDRESS.toString());
    console.log('Client Address:', CLIENT_ADDRESS.toString());
    console.log('Price to Refund:', PRICE_TO_REFUND.toString());
    console.log('Total Output Amount:', totalOutputAmount.toString());
    console.log('Total Input Amount:', totalInputAmount.toString());
    console.log('Number of Supplies:', supplies.length);

    // Log individual supply details
    supplies.forEach((supply, index) => {
        console.log(`Supply ${index}: Input=${supply.input.toString()}, Output=${supply.output.toString()}`);
    });
}
