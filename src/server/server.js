import express from 'express';
import cors from 'cors';

let app=express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
}));

export default app;