import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { OTC } from '../build/OTC/OTC_OTC';
import '@ton/test-utils';

describe('OTC', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let oTC: SandboxContract<OTC>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        oTC = blockchain.openContract(await OTC.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await oTC.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            null,
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: oTC.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and oTC are ready to use
    });
});
