import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Dictionary, Address, toNano, beginCell } from '@ton/core';
import { OTC, Supply, TOTAL_LOCK_PERIOD, STATE_FUNDING, STATE_SUPPLY_IN_PROGRESS, STATE_SUPPLY_PROVIDED, STATE_WAITTING_FOR_CLIENT_ANSWER, STATE_CLIENT_ACCEPTED, STATE_CLIENT_REJECTED, STATE_CANCELED } from '../build/OTC/OTC_OTC';
import '@ton/test-utils';
import { JettonMinter } from '../build/JettonMinter/JettonMinter_JettonMinter';
import { JettonWallet } from '../build/JettonMinter/JettonMinter_JettonWallet';
import { verifyTransactions } from './utils/verifyTransactions';



const SUPPLY_LOCK_PERIOD = 10*24*60*60;

describe('OTC', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let client: SandboxContract<TreasuryContract>;
    let poc: SandboxContract<TreasuryContract>;
    let otc: SandboxContract<OTC>;
    let launchJetton: SandboxContract<JettonMinter>;
    let supplyJetton: SandboxContract<JettonMinter>;
    let supplyDictionary: Dictionary<number, Supply> = Dictionary.empty();
    const ZERO_ADDRESS = Address.parse('UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ');

    // Define meaningful constants for OTC initialization
    const OTC_ID = 1n;
    const PRICE_TO_REFUND = toNano('0.1'); // 0.1 TON for refund
    const OUTPUT_MIN_AMOUNT = toNano('100'); // Minimum output amount
    const MIN_INPUT_AMOUNT = toNano('0'); // Minimum input amount

    const FIRST_SUPPLY: Supply = {
        $$type: 'Supply',
        input: 10000000000000000000000000n,
        output: 100000000000000000000000000n,
    };

    const SECOND_SUPPLY: Supply = {
        $$type: 'Supply',
        input: 20000000000000000000000000n,
        output: 200000000000000000000000000n,
    };

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        client = await blockchain.treasury('client');
        poc = await blockchain.treasury('poc');

        launchJetton = blockchain.openContract(
            await JettonMinter.fromInit(109999990000000000000000000000000n, deployer.address, beginCell().endCell(), true),
        );

        const mintResult = await launchJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'Mint',
                mintMessage: {
                    $$type: 'JettonTransferInternal',
                    queryId: 0n,
                    amount: FIRST_SUPPLY.output + SECOND_SUPPLY.output, // Mint 100 tokens
                    sender: deployer.address,
                    responseDestination: null,
                    forwardTonAmount: 0n,
                    forwardPayload: beginCell().storeUint(0, 32).endCell().asSlice(),
                },
                receiver: deployer.address,
                queryId: 0n,
            },
        );

        await verifyTransactions(mintResult.transactions, deployer.address);
        blockchain.now = mintResult.transactions[1].now + 1000;

        supplyJetton = blockchain.openContract(
            await JettonMinter.fromInit(10000000000000000000000000000n, deployer.address, beginCell().endCell(), true),
        );

        const mintResult2 = await supplyJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'Mint',
                mintMessage: {
                    $$type: 'JettonTransferInternal',
                    queryId: 0n,
                    amount: FIRST_SUPPLY.input + SECOND_SUPPLY.input, // Mint 100 tokens
                    sender: deployer.address,
                    responseDestination: null,
                    forwardTonAmount: 0n,
                    forwardPayload: beginCell().storeUint(0, 32).endCell().asSlice(),
                },
                receiver: client.address,
                queryId: 0n,
            },
        );
        await verifyTransactions(mintResult2.transactions, deployer.address);

        supplyDictionary.set(0, FIRST_SUPPLY);
        supplyDictionary.set(1, SECOND_SUPPLY);

        otc = blockchain.openContract(
            await OTC.fromInit(
                OTC_ID,
                supplyJetton.address,
                launchJetton.address,
                deployer.address,
                client.address,
                supplyDictionary,
                PRICE_TO_REFUND,
                FIRST_SUPPLY.output + SECOND_SUPPLY.output,
                FIRST_SUPPLY.input + SECOND_SUPPLY.input,
                true,
            ),
        );


        // await supplyJetton.send(
        //     deployer.getSender(),
        //     {
        //         value: toNano('0.1'),
        //     },
        //     {
        //         $$type: 'Mint',
        //         amount: 1n, // Mint 100 tokens
        //         receiver: otc.address,
        //     },
        // );

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

    it('should successfully deposit output token', async () => {
        const supplyWallet = blockchain.openContract(
            await JettonWallet.fromInit(client.address, supplyJetton.address, 0n),
        );

        const launchJettonWallet = blockchain.openContract(
            await JettonWallet.fromInit(deployer.address, launchJetton.address, 0n),
        );
        const sendResult = await supplyWallet.send(
            client.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'JettonTransfer',
                queryId: 0n,
                amount: FIRST_SUPPLY.input + SECOND_SUPPLY.input,
                destination: otc.address,
                forwardTonAmount: 0n,
                forwardPayload: beginCell().storeUint(0, 32).endCell().asSlice(),
                responseDestination: deployer.address,
                customPayload: beginCell().endCell(),
            },
        );
        await verifyTransactions(sendResult.transactions, deployer.address);

        const checkInput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.3'),
            },
            "check-input",
        );

        let state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_IN_PROGRESS.toString());

        await verifyTransactions(checkInput.transactions, client.address);

        const launchJettonSupplyResult = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('4'),
            },
            {       
                $$type: 'JettonTransfer',
                queryId: 0n,
                amount: FIRST_SUPPLY.output,
                destination: otc.address,
                forwardTonAmount: toNano('3'),
                forwardPayload: beginCell().storeUint(0, 32).endCell().asSlice(),
                responseDestination: deployer.address,
                customPayload: null,
            },
        );
        await verifyTransactions(launchJettonSupplyResult.transactions, deployer.address);

        
        const launchJettonSupplyResult2 = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('4'),
            },
            {
                $$type: 'JettonTransfer',
                amount: SECOND_SUPPLY.output,
                destination: otc.address,   
                forwardTonAmount: toNano('3'),
                forwardPayload: beginCell().storeUint(0, 32).endCell().asSlice(),
                queryId: 0n,
                responseDestination: deployer.address,
                customPayload: null,
            },
        );
        await verifyTransactions(launchJettonSupplyResult2.transactions, deployer.address);
        state = await otc.getCurrentState();
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
                    sendData: beginCell().storeUint(0, 32).endCell(),
                },
            },
        );
        await verifyTransactions(proposeFarmAccountResult.transactions, client.address);

        const sendResultVote = await otc.send(
            client.getSender(),
            {
                value: toNano('0.3'),
            },
            "yes",
        );
        await verifyTransactions(sendResultVote.transactions, poc.address);

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

        const pocJettonWallet = blockchain.openContract(
            await JettonWallet.fromInit(poc.address, launchJetton.address, 0n),
        );

        const {balance: pocBalance} = await pocJettonWallet.getGetWalletData();
        expect(pocBalance.toString()).toBe((FIRST_SUPPLY.output+SECOND_SUPPLY.output).toString());


    });

    it('should successfully deposit output token', async () => {
        const supplyWallet = blockchain.openContract(
            await JettonWallet.fromInit(client.address, supplyJetton.address, 0n),
        );

        const launchJettonWallet = blockchain.openContract(
            await JettonWallet.fromInit(deployer.address, launchJetton.address, 0n),
        );
        const sendResult = await supplyWallet.send(
            client.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'JettonTransfer',
                amount: FIRST_SUPPLY.input + SECOND_SUPPLY.input,
                destination: otc.address,
                forwardTonAmount: 0n,
                forwardPayload: beginCell().storeUint(0, 32).endCell().asSlice(),
                queryId: 0n,
                responseDestination: deployer.address,
                customPayload: null,
                },
        );
        await verifyTransactions(sendResult.transactions, deployer.address);

        const checkInput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.3'),
            },
            "check-input",
        );

        let state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_IN_PROGRESS.toString());

        await verifyTransactions(checkInput.transactions, client.address);

        const launchJettonSupplyResult = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('4'),
            },
            {
                $$type: 'JettonTransfer',
                amount: FIRST_SUPPLY.output,
                destination: otc.address,
                forwardTonAmount: toNano('3'),
                forwardPayload: beginCell().storeUint(0, 32).endCell().asSlice(),
                queryId: 0n,
                responseDestination: deployer.address,
                customPayload: null,
            },
        );
        await verifyTransactions(launchJettonSupplyResult.transactions, deployer.address);

        
        const launchJettonSupplyResult2 = await launchJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('4'),
            },
            {
                $$type: 'JettonTransfer',
                amount: SECOND_SUPPLY.output,
                destination: otc.address,
                forwardTonAmount: toNano('3'),
                forwardPayload: beginCell().storeUint(0, 32).endCell().asSlice(),
                queryId: 0n,
                responseDestination: deployer.address,
                customPayload: null,
            },
        );
        await verifyTransactions(launchJettonSupplyResult2.transactions, deployer.address);
        state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_PROVIDED.toString());


        blockchain.now! += Number(TOTAL_LOCK_PERIOD)+1;
        const withdrawInput = await otc.send(
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
        await verifyTransactions(withdrawInput.transactions, client.address);
        const clientJettonWallet = blockchain.openContract(
            await JettonWallet.fromInit(client.address, launchJetton.address, 0n),
        );
        const {balance: inputBalance} = await clientJettonWallet.getGetWalletData();
        expect(inputBalance.toString()).toBe((FIRST_SUPPLY.output + SECOND_SUPPLY.output).toString());


    });



    it('should successfully withdraw input token', async () => {
        const supplyWallet = blockchain.openContract(
            await JettonWallet.fromInit(client.address, supplyJetton.address, 0n),
        );

        const launchJettonWallet = blockchain.openContract(
            await JettonWallet.fromInit(deployer.address, launchJetton.address, 0n),
        );
        const sendResult = await supplyWallet.send(
            client.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'JettonTransfer',
                amount: FIRST_SUPPLY.input + SECOND_SUPPLY.input,
                destination: otc.address,
                forwardTonAmount: 0n,
                forwardPayload: beginCell().storeUint(0, 32).endCell().asSlice(),
                queryId: 0n,
                responseDestination: deployer.address,
                customPayload: null,
            },
        );
        await verifyTransactions(sendResult.transactions, deployer.address);

        const checkInput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.3'),
            },
            "check-input",
        );

        let state = await otc.getCurrentState();
        expect(state.toString()).toBe(STATE_SUPPLY_IN_PROGRESS.toString());

        await verifyTransactions(checkInput.transactions, client.address);
        
        blockchain.now! += SUPPLY_LOCK_PERIOD+1;

        const checkOutput = await otc.send(
            client.getSender(),
            {
                value: toNano('0.2'),
            },
            {
                $$type: 'WithdrawInput',
                queryId: 0n,
                amount: FIRST_SUPPLY.input + SECOND_SUPPLY.input,
            },
        );
        await verifyTransactions(checkOutput.transactions, client.address);

        const clientJettonWallet = blockchain.openContract(
            await JettonWallet.fromInit(client.address, supplyJetton.address, 0n),
        );

        const {balance: inputBalance} = await clientJettonWallet.getGetWalletData();
        const InputAmount = FIRST_SUPPLY.input + SECOND_SUPPLY.input;
        expect(inputBalance.toString()).toBe(InputAmount.toString());
    });
});
