import 'dotenv/config';
import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { router } from './routes';
import * as http from 'http';

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

app.use('/api', router);

const server = http.createServer(app);

server.listen(PORT, () => console.log(`Listo por el puerto ${PORT}`));
