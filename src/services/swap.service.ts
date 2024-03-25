import { KeyPair, utils } from 'near-api-js';
import { Account, keyStores, Near } from 'near-api-js';
import nearUtils, { AccountService } from './near.utils';
import {
  DCLSwap,
  Pool,
  StablePool,
  SwapOptions,
  Transaction,
  estimateSwap,
  fetchAllPools,
  ftGetTokensMetadata,
  getDCLPoolId,
  getStablePools,
  instantSwap,
} from '@ref-finance/ref-sdk';
import nearService from './near.service';
import swapUtils from './swap.utils';
import BN from 'bn.js';

const previewSwap = async (tokenInAux: string, tokenOutAux: string, address: string, amount: number) => {
  try {
    console.log('ENTRO');

    const NEAR = process.env.NETWORK === 'mainnet' ? 'near' : 'testnet';

    const tokenIn = tokenInAux === 'near' ? `wrap.${NEAR}` : tokenInAux;
    const tokenOut = tokenOutAux === 'near' ? `wrap.${NEAR}` : tokenOutAux;

    const tokensMetadata = await ftGetTokensMetadata([tokenIn, tokenOut]);

    console.log('AQUI VA 0');

    const transactionsRef = await swapUtils.getTxSwapRef(
      tokensMetadata[tokenIn],
      tokensMetadata[tokenOut],
      amount,
      address,
    );

    console.log('AQUI VA 4');

    const transactionsDcl = await swapUtils.getTxSwapDCL(tokensMetadata[tokenIn], tokensMetadata[tokenOut], amount);

    const minAmountRef = await swapUtils.getMinAmountOut(transactionsRef, tokenOut);

    let minAmountDcl: any;

    console.log('AQUI VA');

    if (process.env.NETWORK === 'mainnet') {
      minAmountDcl = await swapUtils.getMinAmountOut(transactionsDcl, tokenOut);
    } else {
      minAmountDcl = 0;
    }

    console.log(minAmountRef, minAmountDcl);

    let minAmountOut: any = 0;

    const txMain = transactionsRef;
    minAmountOut = minAmountRef;

    if (!txMain || !minAmountOut) return;

    console.log('AQUI VA 2');

    const transaction = txMain.find(
      (element: { functionCalls: { methodName: string }[] }) =>
        element.functionCalls[0].methodName === 'ft_transfer_call',
    );

    if (!transaction) return false;

    const transfer: any = transaction.functionCalls[0].args;
    const amountIn = transfer.amount;

    //   "txMain": [
    //     {
    //         "receiverId": "wrap.near",
    //         "functionCalls": [
    //             {
    //                 "methodName": "ft_transfer_call",
    //                 "args": {
    //                     "receiver_id": "v2.ref-finance.near",
    //                     "amount": "499960000000000000000000",
    //                     "msg": "{\"force\":0,\"actions\":[{\"pool_id\":2,\"token_in\":\"wrap.near\",\"token_out\":\"6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near\",\"amount_in\":\"262910199221940314503351\",\"min_amount_out\":\"0\"},{\"pool_id\":67,\"token_in\":\"6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near\",\"token_out\":\"dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near\",\"min_amount_out\":\"1921623\"},{\"pool_id\":79,\"token_in\":\"wrap.near\",\"token_out\":\"token.v2.ref-finance.near\",\"amount_in\":\"237049800778059685496649\",\"min_amount_out\":\"0\"},{\"pool_id\":81,\"token_in\":\"token.v2.ref-finance.near\",\"token_out\":\"dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near\",\"min_amount_out\":\"1749867\"}]}"
    //                 },
    //                 "gas": "180000000000000",
    //                 "amount": "0.000000000000000000000001"
    //             }
    //         ]
    //     }
    // ]

    let nearTransactions: Transaction[] = [];

    if (tokenIn.includes('wrap.')) {
      nearTransactions.push({
        receiverId: `wrap.${NEAR}`,
        functionCalls: [
          {
            methodName: 'near_deposit',
            args: {},
            gas: '300000000000000',
            amount: amountIn,
          },
        ],
      });
    }

    for (const tx of txMain) {
      for (let i = 0; i < tx.functionCalls.length; i++) {
        tx.functionCalls[i].amount = String(utils.format.parseNearAmount(tx.functionCalls[i].amount));
      }
      nearTransactions.push(tx);
    }

    let secondNum;
    if (tokenOut === `wrap.${NEAR}`) {
      secondNum = minAmountOut;
      minAmountOut = utils.format.parseNearAmount(String(minAmountOut));
    } else {
      secondNum = minAmountOut / Math.pow(10, Number(tokensMetadata[tokenOut].decimals));
    }

    if (tokenOut.includes('wrap.')) {
      nearTransactions.push({
        receiverId: `wrap.${NEAR}`,
        functionCalls: [
          {
            methodName: 'near_withdraw',
            args: { amount: minAmountOut },
            gas: '300000000000000',
            amount: '1',
          },
        ],
      });
    }

    const firstNum = Number(amountIn) / Math.pow(10, Number(tokensMetadata[tokenIn].decimals));

    const swapRate = String(secondNum / firstNum);

    const dataSwap = {
      exchange: 'Ref Finance',
      fromAmount: amountIn,
      fromDecimals: tokensMetadata[tokenIn].decimals,
      toAmount: String(minAmountOut),
      toDecimals: tokensMetadata[tokenOut].decimals,
      swapRate,
      contract: tokenIn,
    };

    return { dataSwap, priceRoute: nearTransactions };
  } catch (error) {
    throw new Error(`Failed to previewSwap: ${error}`);
  }
};

export default { previewSwap };

// async sendSwap(priceRoute: any, privateKey: string, address: string): Promise<any> {
//   try {
//     const transaction = priceRoute.txMain.find(
//       (element: { functionCalls: { methodName: string }[] }) => element.functionCalls[0].methodName === "ft_transfer_call"
//     );

//     if (!transaction) throw new Error(`Failed to create tx.`);

//     const tokensMetadata = await ftGetTokensMetadata([priceRoute.tokenIn, priceRoute.tokenOut]);

//     const tokenIn = tokensMetadata[priceRoute.tokenIn];
//     const tokenOut = tokensMetadata[priceRoute.tokenOut];

//     const keyStore = new keyStores.InMemoryKeyStore();

//     const keyPair = KeyPair.fromString(privateKey);
//     keyStore.setKey(process.env.NEAR_ENV!, address, keyPair);
//     const near = new Near(NearUtils.ConfigNEAR(keyStore));

//     const account = new AccountService(near.connection, address);

//     let nearTransactions = [];

//     if (priceRoute.tokenIn.includes("wrap.")) {
//       const trx = await NearUtils.createTransaction(
//         priceRoute.tokenIn,
//         [await functionCall("near_deposit", {}, new BN("300000000000000"), new BN(priceRoute.amountIn))],
//         address,
//         near
//       );

//       nearTransactions.push(trx);
//     }

//     const trxs = await Promise.all(
//       priceRoute.txMain.map(async (tx: any) => {
//         return await NearUtils.createTransaction(
//           tx.receiverId,
//           tx.functionCalls.map((fc: any) => {
//             return functionCall(fc.methodName, fc.args, fc.gas, new BN(String(utils.format.parseNearAmount(fc.amount))));
//           }),
//           address,
//           near
//         );
//       })
//     );

//     nearTransactions = nearTransactions.concat(trxs);

//     if (priceRoute.tokenOut.includes("wrap.")) {
//       const trx = await NearUtils.createTransaction(
//         priceRoute.minAmountOut,
//         [await functionCall("near_withdraw", { amount: priceRoute.minAmountOut }, new BN("300000000000000"), new BN("1"))],
//         address,
//         near
//       );

//       nearTransactions.push(trx);
//     }

//     let resultSwap: any;
//     for (let trx of nearTransactions) {
//       const result = await account.signAndSendTrx(trx);

//       if (trx.actions[0].functionCall.methodName === "ft_transfer_call") {
//         resultSwap = result;
//       }
//     }

//     if (!resultSwap.transaction.hash) return false;

//     const transactionHash = resultSwap.transaction.hash;
//     const block = resultSwap.transaction_outcome.block_hash;

//     if (!transactionHash) return false;

//     const srcAmount = String(Number(priceRoute.amountIn) / Math.pow(10, tokenIn.decimals));
//     const destAmount = String(Number(priceRoute.minAmountOut) / Math.pow(10, tokenOut.decimals));

//     return {
//       transactionHash,
//       srcAmount,
//       destAmount,
//       block,
//     };
//   } catch (err: any) {
//     console.log(err);
//     throw new Error(`Failed to send swap, ${err.message}`);
//   }
// }
