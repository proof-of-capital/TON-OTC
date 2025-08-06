import { toNano } from '@ton/core';
import { OTC } from '../build/OTC/OTC_OTC';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const oTC = provider.open(await OTC.fromInit());

    await oTC.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        null,
    );

    await provider.waitForDeploy(oTC.address);

    // run methods on `oTC`
}
