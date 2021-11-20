require('dotenv').config();

globalThis.__appdir = __dirname;

const { Bot } = require('./src/Bot');
const Client = require('./src/Client');

//* these are the only three env vars used

const MPPCLONE_TOKEN = process.env.MPPCLONE_TOKEN;
const MPP_URI = process.env.MPP_URI;
const MPP_CHANNEL = process.env.MPP_CHANNEL;

let cl = new Client(MPP_URI, MPPCLONE_TOKEN);
let bot = new Bot(cl, MPP_CHANNEL);

/**
 * express server
 */

const express = require('express');

const app = express();

app.get('/', (req, res) => {
    let obj = bot.getPublicData();
    Object.assign(obj, {m: 'bot'});
    res.send(JSON.stringify(obj));
});

app.get('/cursor', (req, res) => {
    let obj = bot.getCursorData();
    Object.assign(obj, {m: 'cursor_data'});
    res.send(JSON.stringify(obj));
});

const router = express.Router();

app.use('/chat', router);

router.use('/', express.static("chat-app"));

router.use(express.json());

router.post('/', (req, res, next) => {
    let msg = req.body;

    cl.sendChat(msg.message);
    
    res.send(JSON.stringify({m: 'received'}));
});

// app.listen(6969);
app.listen(42069);
