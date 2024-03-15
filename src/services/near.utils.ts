import { Account, Contract, utils } from 'near-api-js';
import { Action, createTransaction, functionCall } from 'near-api-js/lib/transaction';
import { PublicKey } from 'near-api-js/lib/utils';
import { ConnectedWalletAccount, Near, WalletConnection } from 'near-api-js';
import BN from 'bn.js';

const NETWORK = process.env.NEAR_ENV || 'testnet';

export class AccountService extends Account {
  public async signAndSendTrx(trx: any) {
    return await this.signAndSendTransaction(trx);
  }
}

const ConfigNEAR = (keyStores: any) => {
  switch (NETWORK) {
    case 'mainnet':
      return {
        networkId: 'mainnet',
        nodeUrl: 'https://rpc.mainnet.near.org',
        keyStore: keyStores,
        walletUrl: 'https://wallet.near.org',
        helperUrl: 'https://helper.mainnet.near.org',
        explorerUrl: 'https://explorer.mainnet.near.org',
      };
    case 'testnet':
      return {
        networkId: 'testnet',
        keyStore: keyStores,
        nodeUrl: 'https://rpc.testnet.near.org',
        walletUrl: 'https://wallet.testnet.near.org',
        helperUrl: 'https://helper.testnet.near.org',
        explorerUrl: 'https://explorer.testnet.near.org',
      };
    default:
      throw new Error(`Unconfigured environment '${NETWORK}'`);
  }
};

const createTransactionFn = async (receiverId: string, actions: Action[], userAddress: string, near: Near) => {
  const walletConnection = new WalletConnection(near, 'micro-near');
  const wallet = new ConnectedWalletAccount(walletConnection, near.connection, userAddress);

  if (!wallet || !near) {
    throw new Error(`No active wallet or NEAR connection.`);
  }

  const localKey = await near?.connection.signer.getPublicKey(userAddress, near.connection.networkId);

  const accessKey = await wallet.accessKeyForTransaction(receiverId, actions, localKey);

  if (!accessKey) {
    throw new Error(`Cannot find matching key for transaction sent to ${receiverId}`);
  }

  const block = await near?.connection.provider.block({
    finality: 'final',
  });

  if (!block) {
    throw new Error(`Cannot find block for transaction sent to ${receiverId}`);
  }

  const blockHash = utils.serialize.base_decode(block?.header?.hash);

  const publicKey = PublicKey.from(accessKey.public_key);
  const nonce = ++accessKey.access_key.nonce;

  return createTransaction(userAddress, publicKey, receiverId, nonce, actions, blockHash);
};

const activateAccount = async (
  account: AccountService,
  fromAddress: string,
  toAddress: string,
  srcToken: string,
  near: Near,
) => {
  try {
    if (!toAddress) return false;
    const contract: any = new Contract(
      account, // the account object that is connecting
      srcToken,
      {
        viewMethods: ['storage_balance_of'], // view methods do not change state but usually return a value
        changeMethods: [], // change methods modify state
      },
    );

    const addressActivate = await contract.storage_balance_of({
      account_id: toAddress,
    });

    if (addressActivate) return true;

    const trx = await createTransactionFn(
      srcToken,
      [
        await functionCall(
          'storage_deposit',
          {
            registration_only: true,
            account_id: toAddress,
          },
          new BN('300000000000000'),
          new BN('1000000000000000000000'),
        ),
      ],
      fromAddress,
      near,
    );

    const result = await account.signAndSendTrx(trx);

    if (!result.transaction.hash) return false;
    return true;
  } catch (error) {
    console.log('ACTIVATE ERR');
    return false;
  }
};

export default { createTransactionFn, ConfigNEAR, activateAccount };
