import { KeyPair, utils } from 'near-api-js';
import { Account, keyStores, Near } from 'near-api-js';
import { functionCall } from 'near-api-js/lib/transaction';
import nearUtils, { AccountService } from './near.utils';
import BN from 'bn.js';
import {
  DCLSwap,
  Pool,
  StablePool,
  SwapOptions,
  estimateSwap,
  fetchAllPools,
  ftGetTokensMetadata,
  getDCLPoolId,
  getStablePools,
  instantSwap,
} from '@ref-finance/ref-sdk';
import nearService from './near.service';
import swapUtils from './swap.utils';

const previewSwap = async (tokenIn: string, tokenOut: string, address: string, amount: number) => {
  try {
    console.log('ENTRO');

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

    let txMain: any;
    let minAmountOut: any = 0;

    txMain = transactionsRef;
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

    console.log('AQUI VA3');

    const NEAR = process.env.NETWORK === 'mainnet' ? 'near' : 'testnet';

    let secondNum;
    if (tokenOut === `wrap.${NEAR}`) {
      secondNum = minAmountOut;
      minAmountOut = utils.format.parseNearAmount(String(minAmountOut));
    } else {
      secondNum = minAmountOut / Math.pow(10, Number(tokensMetadata[tokenOut].decimals));
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

    return { dataSwap, priceRoute: { tokenIn, tokenOut, amountIn, minAmountOut: String(minAmountOut), txMain } };
  } catch (error) {
    throw new Error(`Failed to previewSwap: ${error}`);
  }
};

export default { previewSwap };

// async previewSwap(fromCoin: string, toCoin: string, amount: number, blockchain: string, address: string): Promise<any> {
//     try {
//       let fromToken: any = await UtilsShared.getTokenContract(fromCoin, blockchain);
//       let toToken: any = await UtilsShared.getTokenContract(toCoin, blockchain);

//       if (!fromToken) {
//         fromToken = dataToken;
//       }
//       if (!toToken) {
//         toToken = dataToken;
//       }

//       const tokenIn = fromToken.contract;
//       const tokenOut = toToken.contract;

//       const tokensMetadata = await ftGetTokensMetadata([tokenIn, tokenOut]);

//       const transactionsRef = await NearUtils.getTxSwapRef(tokensMetadata[tokenIn], tokensMetadata[tokenOut], amount, address);

//       const transactionsDcl = await NearUtils.getTxSwapDCL(tokensMetadata[tokenIn], tokensMetadata[tokenOut], amount);

//       const minAmountRef = await NearUtils.getMinAmountOut(transactionsRef, tokenOut);
//       let minAmountDcl: any;
//       if (NETWORK === "testnet") {
//         minAmountDcl = 0;
//       } else {
//         minAmountDcl = await NearUtils.getMinAmountOut(transactionsDcl, tokenOut);
//       }

//       console.log(minAmountRef, minAmountDcl);

//       let txMain: any;
//       let minAmountOut: any = 0;

//       // if (minAmountRef && !minAmountDcl) {
//       //   console.log("REF");
//       //   txMain = transactionsRef;
//       //   minAmountOut = minAmountRef;
//       // } else if (!minAmountRef && minAmountDcl) {
//       //   console.log("DCL");
//       //   txMain = transactionsDcl;
//       //   minAmountOut = minAmountDcl;
//       // } else if (minAmountRef && minAmountDcl) {
//       //   if (minAmountRef > minAmountDcl) {
//       //     console.log("REF");
//       //     txMain = transactionsRef;
//       //     minAmountOut = minAmountRef;
//       //   } else {
//       //     console.log("DCL");
//       //     txMain = transactionsDcl;
//       //     minAmountOut = minAmountDcl;
//       //   }
//       // }

//       txMain = transactionsRef;
//       minAmountOut = minAmountRef;

//       if (!txMain || !minAmountOut) return;

//       const transaction = txMain.find(
//         (element: { functionCalls: { methodName: string }[] }) => element.functionCalls[0].methodName === "ft_transfer_call"
//       );

//       if (!transaction) return false;

//       const transfer: any = transaction.functionCalls[0].args;
//       const amountIn = transfer.amount;

//       const comision = await UtilsShared.getComision(blockchain);
//       let feeTransfer = "0.1";
//       let porcentFee = 0.1;

//       if (comision.swap) {
//         porcentFee = comision.swap / 100;
//       }

//       let feeDefix = String(Number(amount) * porcentFee);

//       let secondNum;
//       if (tokenOut === `wrap.${NEAR}`) {
//         secondNum = minAmountOut;
//         minAmountOut = utils.format.parseNearAmount(String(minAmountOut));
//       } else {
//         secondNum = minAmountOut / Math.pow(10, Number(tokensMetadata[tokenOut].decimals));
//       }

//       const firstNum = Number(amountIn) / Math.pow(10, Number(tokensMetadata[tokenIn].decimals));

//       const swapRate = String(secondNum / firstNum);

//       const dataSwap = {
//         exchange: "Ref Finance",
//         fromAmount: amountIn,
//         fromDecimals: tokensMetadata[tokenIn].decimals,
//         toAmount: String(minAmountOut),
//         toDecimals: tokensMetadata[tokenOut].decimals,
//         block: null,
//         swapRate,
//         contract: tokenIn,
//         fee: String(porcentFee),
//         feeDefix: feeDefix,
//         feeTotal: String(Number(feeDefix)),
//       };

//       return { dataSwap, priceRoute: { tokenIn, tokenOut, amountIn, minAmountOut: String(minAmountOut), txMain } };
//     } catch (error: any) {
//       console.log(error);

//       throw new Error(`Feiled to get preview swap., ${error.message}`);
//     }
//   }
