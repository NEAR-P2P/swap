import { Request, Response } from 'express';
import { HttpStatus } from '../shared/HttpStatus.enum';
import swapService from '../services/swap.service';

const previewSwap = async (req: Request, res: Response) => {
  try {
    const { tokenIn, tokenOut, address, amount } = req.body;

    if (!tokenIn || !tokenOut || !address || !amount || amount <= 0) {
      return res.status(HttpStatus.HTTP_400_BAD_REQUEST).send({ message: 'Invalid data.' });
    }

    const data = await swapService.previewSwap(tokenIn, tokenOut, address, amount);

    return res.json(data);
  } catch (error: any) {
    console.log(error);
    return res.status(HttpStatus.HTTP_500_INTERNAL_SERVER_ERROR).send(error.message || error);
  }
};

export default { previewSwap };
