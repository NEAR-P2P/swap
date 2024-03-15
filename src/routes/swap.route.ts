import { Router } from 'express';
import swapController from '../controllers/swap.controller';

const router = Router();

router.post('/preview-swap', swapController.previewSwap);

export { router };
