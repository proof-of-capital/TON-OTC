import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, Dictionary, toNano } from '@ton/core';
import { OTC, STATE_SUPPLY_PROVIDED, STATE_CLIENT_ACCEPTED, STATE_CLIENT_REJECTED, Supply, OTC_errors_backward } from '../build/OTC/OTC_OTC';
import '@ton/test-utils';
import { MyJetton } from '../build/MyJetton/MyJetton_MyJetton';
import { JettonDefaultWallet } from '../build/MyJetton/MyJetton_JettonDefaultWallet';
import { verifyTransactions } from './utils/verifyTransactions';

describe('OTC without supply', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let client: SandboxContract<TreasuryContract>;
    let poc: SandboxContract<TreasuryContract>;
    let otc: SandboxContract<OTC>;
    let launchJetton: SandboxContract<MyJetton>;
    let supplyJetton: SandboxContract<MyJetton>;
    let supplyDictionary: Dictionary<number, Supply> = Dictionary.empty();
    const ZERO_ADDRESS = Address.parse('UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ');
    
    // Define meaningful constants for OTC initialization
    const OTC_ID = 1n;
    const PRICE_TO_REFUND = toNano('10'); 
    const OUTPUT_MIN_AMOUNT = toNano('100'); // Minimum output amount
    const MIN_INPUT_AMOUNT = toNano('0'); // Minimum input amount

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        client = await blockchain.treasury('client');
        poc = await blockchain.treasury('poc');

        supplyJetton = blockchain.openContract(
            await MyJetton.fromInit(deployer.address, beginCell().endCell(), 10000000000000000000000000000n),
        );
        

        launchJetton = blockchain.openContract(
            await MyJetton.fromInit(deployer.address, beginCell().endCell(), 100000000000000000000000000n),
        );
        const mintResult = await launchJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'Mint',
                amount: OUTPUT_MIN_AMOUNT, // Mint 100 tokens
                receiver: deployer.address,
            },
        );
        const mintResult2 = await supplyJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'Mint',
                amount: OUTPUT_MIN_AMOUNT * 10n, // Mint 100 tokens
                receiver: deployer.address,
            },
        );
        await verifyTransactions(mintResult2.transactions, deployer.address);
        blockchain.now = mintResult.transactions[1].now + 1000;

        expect(mintResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: launchJetton.address,
            success: true,
        });
        otc = blockchain.openContract(
            await OTC.fromInit(OTC_ID, supplyJetton.address, launchJetton.address, deployer.address, client.address, supplyDictionary, PRICE_TO_REFUND, OUTPUT_MIN_AMOUNT, MIN_INPUT_AMOUNT, false),
        );


        const deployResult = await otc.send(
            deployer.getSender(),
            {
                value: toNano('0.2'), // Increased from 0.05 to 0.1 to provide enough TON for contract operations
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

    it('should deploy', async () => {
        expect((await otc.getContractId()).toString()).toBe(OTC_ID.toString());
        // the check is done inside beforeEach
        // blockchain and oTC are ready to use
    });

    it('should return correct values from all getters', async () => {
        // Test contract ID getter
        expect((await otc.getContractId()).toString()).toBe(OTC_ID.toString());

        // Test token master getters
        expect((await otc.getInputTokenMaster()).toString()).toBe(supplyJetton.address.toString()); // Should be null for this test case
        expect((await otc.getOutputTokenMaster()).toString()).toBe(launchJetton.address.toString());

        // Test wallet address getters
        expect((await otc.getInputWallet()).toString()).not.toBe(ZERO_ADDRESS.toString()); 
        expect((await otc.getOutputWallet()).toString()).not.toBe(ZERO_ADDRESS.toString()); 

        // Test participant address getters
        expect((await otc.getAdminAddress()).toString()).toBe(deployer.address.toString());
        expect((await otc.getClientAddress()).toString()).toBe(client.address.toString());

        // Test balance getters
        expect((await otc.getTonBalanceAmount()).toString()).toBe('0'); // Initial TON balance
        expect((await otc.getOutputTokenBalanceAmount()).toString()).toBe('0'); // Initial output token balance

        // Test supply getters
        expect((await otc.getSupplyCountValue()).toString()).toBe('0'); // No supplies in this test
        expect((await otc.getCurrentSupplyIndex()).toString()).toBe('0'); // Initial index

        // Test price and amount getters
        expect((await otc.getRefundPrice()).toString()).toBe(PRICE_TO_REFUND.toString());
        expect((await otc.getMinInputAmountValue()).toString()).toBe(MIN_INPUT_AMOUNT.toString());
        expect((await otc.getMinOutputAmount()).toString()).toBe(OUTPUT_MIN_AMOUNT.toString());

        // Test lock time getters
        expect((Number(await otc.getSupplyLockEndTime()))).toBeGreaterThan(0); // Should be set during deployment
        expect((Number(await otc.getTotalLockEndTime()))).toBe(0); // Should be null initially

        // Test buyback price getter
        expect(await otc.getBuybackPrice()).toBe(PRICE_TO_REFUND); // Should be set to refund price initially

        // Test state getter
        expect((await otc.getCurrentState()).toString()).toBe('0'); // Initial state (STATE_FUNDING)

        // Test withdraw data getters
        expect(await otc.getWithdrawDataInfo()).toBe(null); // Should be null initially
        expect(await otc.getProposedTime()).toBe(null); // Should be null initially

        // Test contract balance getter
        expect((Number(await otc.getBalance()))).toBeGreaterThan(0); // Should have some TON balance after deployment
    });

    it('should successfully deposit output token', async () => {

        const farmerJettonWallet = blockchain.openContract(await JettonDefaultWallet.fromInit(deployer.address, launchJetton.address));
        const sendResult = await farmerJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'TokenTransfer',
                query_id: 1n,
                custom_payload: null,
                forward_ton_amount: toNano('0'),
                forward_payload: beginCell().asSlice(),
                amount: OUTPUT_MIN_AMOUNT,
                recipient: otc.address,
                response_destination: deployer.address,
            },
        );
       await verifyTransactions(sendResult.transactions, deployer.address);

        const checkOutput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.2'),
            },
            "check-output",
        );
        await verifyTransactions(checkOutput.transactions, client.address);
        const state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_PROVIDED.toString());
    });

    it('should successfully buyback output token', async () => {
        const launchJettonWallet = blockchain.openContract(await JettonDefaultWallet.fromInit(deployer.address, launchJetton.address));
        const supplyJettonWallet = blockchain.openContract(await JettonDefaultWallet.fromInit(deployer.address, supplyJetton.address));
        const sendResult = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'TokenTransfer',
                query_id: 1n,
                custom_payload: null,
                forward_ton_amount: toNano('0'),
                forward_payload: beginCell().asSlice(),
                amount: OUTPUT_MIN_AMOUNT,
                recipient: otc.address,
                response_destination: deployer.address,
            },
        );
       await verifyTransactions(sendResult.transactions, deployer.address);

        const checkOutput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.2'),
            },
            "check-output",
        );
    
        await verifyTransactions(checkOutput.transactions, client.address);
        const state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_PROVIDED.toString());

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
        await verifyTransactions(proposeFarmAccountResult.transactions, deployer.address);

        const sendResultVote = await otc.send(

            client.getSender(),
            {
                value: toNano('0.3'),
            },
            "no",
        );
        await verifyTransactions(sendResultVote.transactions, client.address);
        
        // Mint tokens for admin to perform buyback
        const mintForAdmin = await launchJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'Mint',
                amount: OUTPUT_MIN_AMOUNT / 2n,
                receiver: deployer.address,
            },
        );
        await verifyTransactions(mintForAdmin.transactions, deployer.address);

        blockchain.now! += 10*24*60*60+1;
        
        const {balance: outputBalanceBeforeBuyback} = await launchJettonWallet.getGetWalletData();
        const buybackResult = await supplyJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('0.2'),
            },
            {
                $$type: 'TokenTransfer',
                query_id: 2n,
                custom_payload: null,
                forward_ton_amount: toNano('0.1'),
                forward_payload: beginCell().asSlice(),
                amount: OUTPUT_MIN_AMOUNT * 10n / 2n,
                recipient: otc.address,
                response_destination: deployer.address,
            },
        );

        await verifyTransactions(buybackResult.transactions, deployer.address);

        const {balance: outputBalanceAfterBuyback} = await launchJettonWallet.getGetWalletData();

        expect(outputBalanceAfterBuyback.toString()).toBe((outputBalanceBeforeBuyback + OUTPUT_MIN_AMOUNT / 2n).toString());

        await verifyTransactions(buybackResult.transactions, deployer.address);

    });

    it('should fail when admin tries to vote "no" in propose farm account', async () => {
        const launchJettonWallet = blockchain.openContract(await JettonDefaultWallet.fromInit(deployer.address, launchJetton.address));
        const supplyJettonWallet = blockchain.openContract(await JettonDefaultWallet.fromInit(deployer.address, supplyJetton.address));
        const sendResult = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'TokenTransfer',
                query_id: 1n,
                custom_payload: null,
                forward_ton_amount: toNano('0'),
                forward_payload: beginCell().asSlice(),
                amount: OUTPUT_MIN_AMOUNT,
                recipient: otc.address,
                response_destination: deployer.address,
            },
        );
       await verifyTransactions(sendResult.transactions, deployer.address);

        const checkOutput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.2'),
            },
            "check-output",
        );
    
        await verifyTransactions(checkOutput.transactions, client.address);
        const state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_PROVIDED.toString());

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
        await verifyTransactions(proposeFarmAccountResult.transactions, deployer.address);

        const sendResultVote = await otc.send(

            deployer.getSender(),
            {
                value: toNano('0.3'),
            },
            "no",
        );

        expect(sendResultVote.transactions).toHaveTransaction({
            from: deployer.address,
            to: otc.address,
            success: false,
            exitCode: OTC_errors_backward["Only client can call"],
        });

    });


    it('should fail when admin tries to vote "yes" in propose farm account', async () => {
        const launchJettonWallet = blockchain.openContract(await JettonDefaultWallet.fromInit(deployer.address, launchJetton.address));
        const supplyJettonWallet = blockchain.openContract(await JettonDefaultWallet.fromInit(deployer.address, supplyJetton.address));
        const sendResult = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'TokenTransfer',
                query_id: 1n,
                custom_payload: null,
                forward_ton_amount: toNano('0'),
                forward_payload: beginCell().asSlice(),
                amount: OUTPUT_MIN_AMOUNT,
                recipient: otc.address,
                response_destination: deployer.address,
            },
        );
       await verifyTransactions(sendResult.transactions, deployer.address);

        const checkOutput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.2'),
            },
            "check-output",
        );
    
        await verifyTransactions(checkOutput.transactions, client.address);
        const state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_PROVIDED.toString());

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
        await verifyTransactions(proposeFarmAccountResult.transactions, deployer.address);

        const sendResultVote = await otc.send(

            deployer.getSender(),
            {
                value: toNano('0.3'),
            },
            "yes",
        );

        expect(sendResultVote.transactions).toHaveTransaction({
            from: deployer.address,
            to: otc.address,
            success: false,
            exitCode: OTC_errors_backward["Only client can call"],
        });

    });


    it('should fail when client tries to propose farm account', async () => {
        const launchJettonWallet = blockchain.openContract(await JettonDefaultWallet.fromInit(deployer.address, launchJetton.address));
        const supplyJettonWallet = blockchain.openContract(await JettonDefaultWallet.fromInit(deployer.address, supplyJetton.address));
        const sendResult = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'TokenTransfer',
                query_id: 1n,
                custom_payload: null,
                forward_ton_amount: toNano('0'),
                forward_payload: beginCell().asSlice(),
                amount: OUTPUT_MIN_AMOUNT,
                recipient: otc.address,
                response_destination: deployer.address,
            },
        );
       await verifyTransactions(sendResult.transactions, deployer.address);

        const checkOutput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.2'),
            },
            "check-output",
        );
    
        await verifyTransactions(checkOutput.transactions, client.address);
        const state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_PROVIDED.toString());

        const proposeFarmAccountResult = await otc.send(
            client.getSender(),
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

        expect(proposeFarmAccountResult.transactions).toHaveTransaction({
            from: client.address,
            to: otc.address,
            success: false,
            exitCode: OTC_errors_backward["Only admin"],
        });

    });

    it('should allow client to change vote from "no" to "yes"', async () => {
        const launchJettonWallet = blockchain.openContract(await JettonDefaultWallet.fromInit(deployer.address, launchJetton.address));
        const sendResult = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'TokenTransfer',
                query_id: 1n,
                custom_payload: null,
                forward_ton_amount: toNano('0'),
                forward_payload: beginCell().asSlice(),
                amount: OUTPUT_MIN_AMOUNT,
                recipient: otc.address,
                response_destination: deployer.address,
            },
        );
       await verifyTransactions(sendResult.transactions, deployer.address);

        const checkOutput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.2'),
            },
            "check-output",
        );
    
        await verifyTransactions(checkOutput.transactions, client.address);
        const state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_PROVIDED.toString());

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
        await verifyTransactions(proposeFarmAccountResult.transactions, deployer.address);

        // Client votes "no" first
        const voteNoResult = await otc.send(
            client.getSender(),
            {
                value: toNano('0.3'),
            },
            "no",
        );
        await verifyTransactions(voteNoResult.transactions, client.address);
        
        let currentState = await otc.getCurrentState();
        expect(currentState.toString()).toBe(STATE_CLIENT_REJECTED.toString());

        // Client changes vote to "yes"
        const voteYesResult = await otc.send(
            client.getSender(),
            {
                value: toNano('0.3'),
            },
            "yes",
        );
        await verifyTransactions(voteYesResult.transactions, client.address);
        
        currentState = await otc.getCurrentState();
        expect(currentState.toString()).toBe(STATE_CLIENT_ACCEPTED.toString());
    });

    it('should not allow client to change vote from "yes" to "no"', async () => {
        const launchJettonWallet = blockchain.openContract(await JettonDefaultWallet.fromInit(deployer.address, launchJetton.address));
        const sendResult = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'TokenTransfer',
                query_id: 1n,
                custom_payload: null,
                forward_ton_amount: toNano('0'),
                forward_payload: beginCell().asSlice(),
                amount: OUTPUT_MIN_AMOUNT,
                recipient: otc.address,
                response_destination: deployer.address,
            },
        );
       await verifyTransactions(sendResult.transactions, deployer.address);

        const checkOutput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.2'),
            },
            "check-output",
        );
    
        await verifyTransactions(checkOutput.transactions, client.address);
        const state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_PROVIDED.toString());

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
        await verifyTransactions(proposeFarmAccountResult.transactions, deployer.address);

        // Client votes "yes" first
        const voteYesResult = await otc.send(
            client.getSender(),
            {
                value: toNano('0.3'),
            },
            "yes",
        );
        await verifyTransactions(voteYesResult.transactions, client.address);
        
        let currentState = await otc.getCurrentState();
        expect(currentState.toString()).toBe(STATE_CLIENT_ACCEPTED.toString());

        const voteNoResult = await otc.send(
            client.getSender(),
            {
                value: toNano('0.3'),
            },
            "no",
        );
        
        expect(voteNoResult.transactions).toHaveTransaction({
            success: false,
            to: otc.address,
            exitCode: OTC_errors_backward["State must allow client voting"],
        });
        
        // State should remain STATE_CLIENT_ACCEPTED
        currentState = await otc.getCurrentState();
        expect(currentState.toString()).toBe(STATE_CLIENT_ACCEPTED.toString());
    });

});
