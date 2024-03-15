import { KeyPair, utils } from 'near-api-js';
import { Account, keyStores, Near } from 'near-api-js';
import { functionCall } from 'near-api-js/lib/transaction';
import nearUtils, { AccountService } from './near.utils';
import BN from 'bn.js';
import axios from 'axios';

const getNearPrice = async () => {
  try {
    const nearPrice: any = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=NEAR&vs_currencies=USD');

    if (!nearPrice.data.near.usd) throw new Error('Error near usd');
    return nearPrice.data.near.usd;
  } catch (error) {
    const nearPrice = await axios.get('https://nearblocks.io/api/near-price');
    if (!nearPrice.data.usd) throw new Error('Error near usd');
    return nearPrice.data.usd;
  }
};

const getBalance = async (address: string) => {
  try {
    let balanceTotal = 0;

    const keyStore = new keyStores.InMemoryKeyStore();
    const near = new Near(nearUtils.ConfigNEAR(keyStore));

    const account = new Account(near.connection, address);

    const balanceAccount = await account.state();

    const valueStorage = Math.pow(10, 19);
    const valueYocto = Math.pow(10, 24);
    const storage = (balanceAccount.storage_usage * valueStorage) / valueYocto;
    balanceTotal = Number(balanceAccount.amount) / valueYocto - storage;
    if (!balanceTotal || balanceTotal < 0) {
      balanceTotal = 0;
    }
    return balanceTotal;
  } catch (error) {
    throw new Error(`Failed to get balance: ${error}`);
  }
};

const transfer = async (fromAddress: string, privateKey: string, toAddress: string, amount: number) => {
  try {
    const balance = await getBalance(fromAddress);

    if (balance < amount) throw new Error(`Error: You do not have enough funds to make the transfer`);

    const keyStore = new keyStores.InMemoryKeyStore();

    const keyPair = KeyPair.fromString(privateKey);
    keyStore.setKey(process.env.NEAR_ENV!, fromAddress, keyPair);

    const near = new Near(nearUtils.ConfigNEAR(keyStore));

    const account = new AccountService(near.connection, fromAddress);

    const amountInYocto = utils.format.parseNearAmount(String(amount));

    if (!amountInYocto) throw new Error(`Failed to send transfer.`);

    const response = await account.sendMoney(toAddress, new BN(amountInYocto));

    if (!response.transaction.hash) throw new Error(`Failed to send transfer.`);

    return response.transaction.hash as string;
  } catch (err: any) {
    throw new Error(`Failed to send transfer, ${err.message}`);
  }
};

const callContractLog = async (wallet: string) => {
  try {
    const keyStore = new keyStores.InMemoryKeyStore();

    const keyPair = KeyPair.fromString(process.env.APOLO_CONTRACT_PRIVATE_KEY!);
    keyStore.setKey(process.env.NEAR_ENV!, process.env.APOLO_CONTRACT_ADDRESS!, keyPair);
    const near = new Near(nearUtils.ConfigNEAR(keyStore));

    const account = new AccountService(near.connection, process.env.APOLO_CONTRACT_ADDRESS!);

    const trx = await nearUtils.createTransactionFn(
      process.env.APOLO_CONTRACT_ADDRESS!,
      [
        await functionCall(
          'set_wallet',
          {
            wallet,
          },
          new BN('30000000000000'),
          new BN('0'),
        ),
      ],
      process.env.APOLO_CONTRACT_ADDRESS!,
      near,
    );

    const result = await account.signAndSendTrx(trx);

    if (!result.transaction.hash) return false;

    return result.transaction.hash as string;
  } catch (error) {
    console.log(error);
    return false;
  }
};

export default { getNearPrice, getBalance, transfer, callContractLog };
