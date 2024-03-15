import { utils } from 'near-api-js';
import {
  DCLSwap,
  Pool,
  StablePool,
  SwapOptions,
  estimateSwap,
  fetchAllPools,
  getDCLPoolId,
  getStablePools,
  instantSwap,
} from '@ref-finance/ref-sdk';
import nearService from './near.service';

async function getTxSwapRef(tokenMetadataA: any, tokenMetadataB: any, amount: number, address: string) {
  console.log('GET 1');
  const { ratedPools, unRatedPools, simplePools } = await fetchAllPools();

  const stablePools: Pool[] = unRatedPools.concat(ratedPools);

  const stablePoolsDetail: StablePool[] = await getStablePools(stablePools);

  console.log('GET 2');

  const options: SwapOptions = {
    enableSmartRouting: true,
    stablePools,
    stablePoolsDetail,
  };

  const swapAlls = await estimateSwap({
    tokenIn: tokenMetadataA,
    tokenOut: tokenMetadataB,
    amountIn: String(amount),
    simplePools: simplePools,
    options,
  });

  console.log('GET 3');

  const transactionsRef = await instantSwap({
    tokenIn: tokenMetadataA,
    tokenOut: tokenMetadataB,
    amountIn: String(amount),
    swapTodos: swapAlls,
    slippageTolerance: 0.01,
    AccountId: address,
  });

  console.log('GET 4');

  return transactionsRef;
}

async function getTxSwapDCL(tokenMetadataA: any, tokenMetadataB: any, amount: number) {
  const nearUsd = await nearService.getNearPrice();

  const fee = 2000;

  const pool_ids = [getDCLPoolId(tokenMetadataA.id, tokenMetadataB.id, fee)];

  const transactionsDcl = await DCLSwap({
    swapInfo: {
      amountA: String(amount),
      tokenA: tokenMetadataA,
      tokenB: tokenMetadataB,
    },
    Swap: {
      pool_ids,
      min_output_amount: String(Math.round(amount * nearUsd * 0.99 * Math.pow(10, tokenMetadataB.decimals))),
    },
    AccountId: tokenMetadataA.id,
  });

  return transactionsDcl;
}

function getMinAmountOut(trxSwap: any, tokenOut: string) {
  const NEAR = process.env.NETWORK === 'mainnet' ? 'near' : 'testnet';

  const transaction = trxSwap.find(
    (element: {
      functionCalls: {
        methodName: string;
      }[];
    }) => element.functionCalls[0].methodName === 'ft_transfer_call',
  );

  if (!transaction) return false;

  const argsMsg = JSON.parse(transaction.functionCalls[0].args.msg);

  console.log(argsMsg);

  if (Object.keys(argsMsg).includes('actions')) {
    let minAmountOut = 0;
    for (const action of argsMsg.actions) {
      if (action.token_out === tokenOut) {
        if (action.token_out === `wrap.${NEAR}`) {
          minAmountOut += Number(utils.format.formatNearAmount(action.min_amount_out));
        } else {
          console.log(Number(action.min_amount_out));
          minAmountOut += Number(action.min_amount_out);
        }
      }
    }
    return minAmountOut;
  } else if (Object.keys(argsMsg).includes('Swap')) {
    if (tokenOut === `wrap.${NEAR}`) {
      return Number(utils.format.formatNearAmount(argsMsg.Swap.min_output_amount));
    }
    return Number(argsMsg.Swap.min_output_amount);
  } else {
    return 0;
  }
}

export default { getTxSwapRef, getTxSwapDCL, getMinAmountOut };
