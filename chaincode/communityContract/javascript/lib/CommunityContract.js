/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
let contador = 0;

class CommunityContract extends Contract {

    async initLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        const agreements = [
            {
                communityId: 1,
                cost: 25,
                most: 30,
                votesInFavor: 2,
                nay: 4,
                approved: false,
            },
        ];

        for (let i = 0; i < agreements.length; i++) {
            agreements[i].docType = 'agreement';
            await ctx.stub.putState('CONTRACT' + i, Buffer.from(JSON.stringify(agreements[i])));
            console.info('Added <--> ', agreements[i]);
        }
        console.info('============= END : Initialize Ledger ===========');
    }

    async queryAgreement(ctx, agreementNumber) {
        const agreementAsBytes = await ctx.stub.getState(agreementNumber); // get the agreement from chaincode state
        if (!agreementAsBytes || agreementAsBytes.length === 0) {
            throw new Error(`${agreementNumber} does not exist`);
        }
        console.log(agreementAsBytes.toString());
        return agreementAsBytes.toString();
    }

    
    async createAgreement(ctx, communityId, cost, most) {
        console.info('============= START : Create Agreement ===========');

        const agreement = {
            communityId,
            docType: 'agreement',
            cost,
            most,
            votesInFavor: 0,
            nay: 0,
            approved: false,
        };

        const startKey = 'CONTRACT0';
        const endKey = 'CONTRACT999';

        contador = contador + 1;

        await ctx.stub.putState('CONTRACT' + contador, Buffer.from(JSON.stringify(agreement)));
        return JSON.stringify('CONTRACT' + contador);
    }

    

    async queryAllAgreements(ctx) {
        const startKey = 'CONTRACT0';
        const endKey = 'CONTRACT999';

        const iterator = await ctx.stub.getStateByRange(startKey, endKey);

        const allResults = [];
        while (true) {
            const res = await iterator.next();

            if (res.value && res.value.value.toString()) {
                console.log(res.value.value.toString('utf8'));

                const Key = res.value.key;
                let Record;
                try {
                    Record = JSON.parse(res.value.value.toString('utf8'));
                } catch (err) {
                    console.log(err);
                    Record = res.value.value.toString('utf8');
                }
                allResults.push({ Key, Record });
            }
            if (res.done) {
                console.log('end of data');
                await iterator.close();
                console.info(allResults);
                return JSON.stringify(allResults);
            }
        }
    }

    async voteAgreement(ctx, contractId) {
        console.info('============= START : VoteAgreement ===========');

        const agreementAsBytes = await ctx.stub.getState(contractId); // get the CONTRACT from chaincode state
        if (!agreementAsBytes || agreementAsBytes.length === 0) {
            throw new Error(`${contractId} does not exist`);
        }
        const agreement = JSON.parse(agreementAsBytes.toString());

        if ((agreement.votesInFavor + agreement.nay) >= agreement.most) {
            throw new Error(`Completed`);
        }

        agreement.votesInFavor = agreement.votesInFavor + 1;

        if (agreement.votesInFavor >= (agreement.most/2)) agreement.approved = true;

        await ctx.stub.putState(contractId, Buffer.from(JSON.stringify(agreement)));
        console.info('============= END : VoteAgreement ===========');
    }

    async nayAgreement(ctx, contractId) {
        console.info('============= START : NayAgreement ===========');

        const agreementAsBytes = await ctx.stub.getState(contractId); // get the CONTRACT from chaincode state
        if (!agreementAsBytes || agreementAsBytes.length === 0) {
            throw new Error(`${contractId} does not exist`);
        }

        const agreement = JSON.parse(agreementAsBytes.toString());

        if ((agreement.votesInFavor + agreement.nay) >= agreement.most) {
            throw new Error(`Completed`);
        }

        agreement.nay = agreement.nay + 1;

        await ctx.stub.putState(contractId, Buffer.from(JSON.stringify(agreement)));
        console.info('============= END : VoteAgreement ===========');
    }

}

module.exports = CommunityContract;
