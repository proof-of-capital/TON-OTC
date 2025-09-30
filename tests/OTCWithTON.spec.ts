import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Dictionary, Address, toNano, beginCell } from '@ton/core';
import { OTC, Supply, TOTAL_LOCK_PERIOD, STATE_FUNDING, STATE_SUPPLY_IN_PROGRESS, STATE_SUPPLY_PROVIDED, STATE_WAITTING_FOR_CLIENT_ANSWER, STATE_CLIENT_ACCEPTED, STATE_CLIENT_REJECTED, STATE_CANCELED } from '../build/OTC/OTC_OTC';
import '@ton/test-utils';
import { MyJetton } from '../build/MyJetton/MyJetton_MyJetton';
import { JettonDefaultWallet } from '../build/MyJetton/MyJetton_JettonDefaultWallet';
import { verifyTransactions } from './utils/verifyTransactions';


const SUPPLY_LOCK_PERIOD = 10*24*60*60;

describe('OTC with TON instead of supply token', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let client: SandboxContract<TreasuryContract>;
    let poc: SandboxContract<TreasuryContract>;
    let otc: SandboxContract<OTC>;
    let launchJetton: SandboxContract<MyJetton>;
    let supplyDictionary: Dictionary<number, Supply> = Dictionary.empty();
    const ZERO_ADDRESS = Address.parse('UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ');

    // Define meaningful constants for OTC initialization
    const OTC_ID = 1n;
    const PRICE_TO_REFUND = toNano('0.1'); // 0.1 TON for refund
    const OUTPUT_MIN_AMOUNT = toNano('100'); // Minimum output amount
    const MIN_INPUT_AMOUNT = toNano('50'); // Minimum input amount in TON

    const FIRST_SUPPLY: Supply = {
        $$type: 'Supply',
        input: toNano('50'), // 50 TON input
        output: 100000000000000000000000000n, // 100 launch tokens output
    };

    const SECOND_SUPPLY: Supply = {
        $$type: 'Supply',
        input: toNano('100'), // 100 TON input
        output: 200000000000000000000000000n, // 200 launch tokens output
    };

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        client = await blockchain.treasury('client');
        poc = await blockchain.treasury('poc');

        // Create launch jetton (output token)
        launchJetton = blockchain.openContract(
            await MyJetton.fromInit(deployer.address, beginCell().endCell(), 109999990000000000000000000000000n),
        );

        const mintResult = await launchJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'Mint',
                amount: FIRST_SUPPLY.output + SECOND_SUPPLY.output,
                receiver: deployer.address,
            },
        );

        await verifyTransactions(mintResult.transactions, deployer.address);
        blockchain.now = mintResult.transactions[1].now + 1000;

        // Set up supplies dictionary
        supplyDictionary.set(0, FIRST_SUPPLY);
        supplyDictionary.set(1, SECOND_SUPPLY);

        // Create OTC contract with ZERO_ADDRESS as inputMasterToken (TON)
        otc = blockchain.openContract(
            await OTC.fromInit(
                OTC_ID,
                ZERO_ADDRESS, // TON instead of supply token
                launchJetton.address,
                deployer.address,
                client.address,
                supplyDictionary,
                PRICE_TO_REFUND,
                FIRST_SUPPLY.output + SECOND_SUPPLY.output,
                MIN_INPUT_AMOUNT,
                true,
            ),
        );

        const deployResult = await otc.send(
            deployer.getSender(),
            {
                value: toNano('0.3'),
            },
            null,
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: otc.address,
            deploy: true,
            success: true,
        });
        await verifyTransactions(deployResult.transactions, deployer.address);
    });

    it('should successfully deposit TON and transition to supply state', async () => {
        // Client deposits TON to OTC contract
        const depositResult = await otc.send(
            client.getSender(),
            {
                value: FIRST_SUPPLY.input + SECOND_SUPPLY.input + toNano('0.1'), // Send 150 TON
            },
            {
                $$type: 'DepositTon',
                amount: FIRST_SUPPLY.input + SECOND_SUPPLY.input,
            },
        );

        await verifyTransactions(depositResult.transactions, client.address);

        // Check that state changed to SUPPLY_OF_FUNDS
        let state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_IN_PROGRESS.toString());
    });

    it('should successfully complete full OTC cycle with TON', async () => {
        // Step 1: Client deposits TON
        const depositResult = await otc.send(
            client.getSender(),
            {
                value: FIRST_SUPPLY.input + SECOND_SUPPLY.input + toNano('0.1'),
            },
            {
                $$type: 'DepositTon',
                amount: FIRST_SUPPLY.input + SECOND_SUPPLY.input,
            },
        );

        await verifyTransactions(depositResult.transactions, client.address);

        let state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_IN_PROGRESS.toString());

        // Step 2: Deployer supplies launch tokens
        const launchJettonWallet = blockchain.openContract(
            await JettonDefaultWallet.fromInit(deployer.address, launchJetton.address),
        );

        const launchJettonSupplyResult = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('4'),
            },
            {
                $$type: 'TokenTransfer',
                amount: FIRST_SUPPLY.output,
                recipient: otc.address,
                forward_ton_amount: toNano('3'),
                forward_payload: beginCell().asSlice(),
                query_id: 0n,
                response_destination: deployer.address,
                custom_payload: null,
            },
        );
        await verifyTransactions(launchJettonSupplyResult.transactions, deployer.address);

        const launchJettonSupplyResult2 = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('4'),
            },
            {
                $$type: 'TokenTransfer',
                amount: SECOND_SUPPLY.output,
                recipient: otc.address,
                forward_ton_amount: toNano('3'),
                forward_payload: beginCell().asSlice(),
                query_id: 0n,
                response_destination: deployer.address,
                custom_payload: null,
            },
        );
        await verifyTransactions(launchJettonSupplyResult2.transactions, deployer.address);

        // Check state transition to waiting for client answer
        state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_PROVIDED.toString());

        // Step 3: Propose farm account
        const proposeFarmAccountResult = await otc.send(
            deployer.getSender(),
            {
                value: toNano('0.3'),
            },
            {
                $$type: 'ProposeFarmAccount',
                queryId: 0n,
                withdrawData: {
                    $$type: 'FarmWithdrawData',
                    farmAccount: poc.address,
                    sendData: beginCell().endCell(),
                },
            },
        );
        await verifyTransactions(proposeFarmAccountResult.transactions, client.address);

        // Step 4: Client votes yes
        const sendResultVote = await otc.send(
            client.getSender(),
            {
                value: toNano('0.3'),
            },
            "yes",
        );
        await verifyTransactions(sendResultVote.transactions, poc.address);

        // Step 5: Send tokens to farm
        const sendResultSend = await otc.send(
            deployer.getSender(),
            {
                value: toNano('0.3'),
            },
            {
                $$type: 'Send',
                queryId: 0n,
                forwardTonAmount: toNano('0.1'),
            },
        );
        await verifyTransactions(sendResultSend.transactions, poc.address);

        // Verify farm received the tokens
        const pocJettonWallet = blockchain.openContract(
            await JettonDefaultWallet.fromInit(poc.address, launchJetton.address),
        );

        const {balance: pocBalance} = await pocJettonWallet.getGetWalletData();
        expect(pocBalance.toString()).toBe((FIRST_SUPPLY.output + SECOND_SUPPLY.output).toString());
    });

    it('should allow client to withdraw TON after lock period expires', async () => {
        // Step 1: Client deposits TON
        const depositResult = await otc.send(
            client.getSender(),
            {
                value: FIRST_SUPPLY.input + SECOND_SUPPLY.input + toNano('0.1'),
            },
            {
                $$type: 'DepositTon',
                amount: FIRST_SUPPLY.input + SECOND_SUPPLY.input,
            },
        );

        await verifyTransactions(depositResult.transactions, client.address);

        let state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_IN_PROGRESS.toString());

        // Step 2: Deployer supplies launch tokens
        const launchJettonWallet = blockchain.openContract(
            await JettonDefaultWallet.fromInit(deployer.address, launchJetton.address),
        );



        // Step 3: Wait for lock period to expire and withdraw TON
        blockchain.now! += Number(SUPPLY_LOCK_PERIOD) + 1;

        const clientBalanceBefore = await client.getBalance();
        
        const withdrawInput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.2'),
            },
            "withdraw-ton",
        );
        await verifyTransactions(withdrawInput.transactions, client.address);

        // Verify client received the TON back
        const clientBalanceAfter = await client.getBalance();
        expect(Number(clientBalanceAfter)).toBeGreaterThan(Number(clientBalanceBefore));
    });

    it('should allow client to withdraw launch tokens after lock period expires', async () => {
        // Step 1: Client deposits TON
        const depositResult = await otc.send(
            client.getSender(),
            {
                value: FIRST_SUPPLY.input + SECOND_SUPPLY.input + toNano('0.1'),
            },
            {
                $$type: 'DepositTon',
                amount: FIRST_SUPPLY.input + SECOND_SUPPLY.input,
            },
        );

        await verifyTransactions(depositResult.transactions, client.address);

        let state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_IN_PROGRESS.toString());

        // Step 2: Deployer supplies launch tokens
        const launchJettonWallet = blockchain.openContract(
            await JettonDefaultWallet.fromInit(deployer.address, launchJetton.address),
        );

        const launchJettonSupplyResult = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('4'),
            },
            {
                $$type: 'TokenTransfer',
                amount: FIRST_SUPPLY.output,
                recipient: otc.address,
                forward_ton_amount: toNano('3'),
                forward_payload: beginCell().asSlice(),
                query_id: 0n,
                response_destination: deployer.address,
                custom_payload: null,
            },
        );
        await verifyTransactions(launchJettonSupplyResult.transactions, deployer.address);

        const launchJettonSupplyResult2 = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('4'),
            },
            {
                $$type: 'TokenTransfer',
                amount: SECOND_SUPPLY.output,
                recipient: otc.address,
                forward_ton_amount: toNano('3'),
                forward_payload: beginCell().asSlice(),
                query_id: 0n,
                response_destination: deployer.address,
                custom_payload: null,
            },
        );
        await verifyTransactions(launchJettonSupplyResult2.transactions, deployer.address);

        state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_PROVIDED.toString());

        // Step 3: Wait for lock period to expire and withdraw output tokens
        blockchain.now! += Number(TOTAL_LOCK_PERIOD) + 1;
        
        const withdrawOutput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.2'),
            },
            {
                $$type: 'WithdrawOutput',
                queryId: 0n,
                amount: FIRST_SUPPLY.output + SECOND_SUPPLY.output,
            },
        );
        await verifyTransactions(withdrawOutput.transactions, client.address);

        // Verify client received the launch tokens
        const clientJettonWallet = blockchain.openContract(
            await JettonDefaultWallet.fromInit(client.address, launchJetton.address),
        );
        
        const {balance: clientBalance} = await clientJettonWallet.getGetWalletData();
        expect(clientBalance.toString()).toBe((FIRST_SUPPLY.output + SECOND_SUPPLY.output).toString());
    });

    it('should allow client to withdraw TON using withdraw-ton message', async () => {
        // Step 1: Client deposits TON
        const depositResult = await otc.send(
            client.getSender(),
            {
                value: FIRST_SUPPLY.input + SECOND_SUPPLY.input + toNano('0.1'),
            },
            {
                $$type: 'DepositTon',
                amount: FIRST_SUPPLY.input + SECOND_SUPPLY.input,
            },
        );

        await verifyTransactions(depositResult.transactions, client.address);

        let state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_IN_PROGRESS.toString());

        // Step 2: Wait for supply lock period to expire
        blockchain.now! += SUPPLY_LOCK_PERIOD + 1;

        // Step 3: Client withdraws TON using withdraw-ton message
        const withdrawTonResult = await otc.send(
            client.getSender(),
            {
                value: toNano('0.1'),
            },
            "withdraw-ton",
        );

        await verifyTransactions(withdrawTonResult.transactions, client.address);

        // Verify client received the TON back
        const clientBalance = await client.getBalance();
        expect(clientBalance).toBeGreaterThan(0n);
    });
});
