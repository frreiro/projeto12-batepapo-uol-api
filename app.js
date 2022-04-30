import express from "express";
import chalk from "chalk";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import Joi from "joi";


dotenv.config();

console.log()

const app = express();
app.use(cors());
app.use(express.json());


const currentTime = () => dayjs().format('HH:mm:ss');
const userSchema = Joi.string().min(3).required();
const textError = (text) => chalk.red(text)


// conexão com o banco de dados
let db = null;
const mongoClient = new MongoClient(process.env.MONGO_URI);
mongoClient.connect()
    .then(() => {
        db = mongoClient.db(process.env.DB_NAME);
        console.log(chalk.blue.bold("Conectado no banco de dados"))
    })
    .catch(error => console.log(chalk.red.bold("Não foi possível conectar no banco de dados"), error));

setInterval(deleteInative, 15000)

//FIXME: aumentar a legibilidade do setInverval e deleteInative
async function deleteInative() {
    try {
        const allParticipants = await db.collection("participants").find({}).toArray();
        await allParticipants.forEach(async (participant) => {
            const { name, lastStatus } = participant;
            if (Date.now() - parseInt(lastStatus) >= 10000) {
                await db.collection("participants").deleteOne(participant);
                db.collection("messages").insertOne({
                    from: name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: currentTime()
                });
            }
        });
    } catch (e) {
        console.log(e);
    }
}




app.post("/participants", async (req, res) => {
    const { name } = req.body


    const participant = {
        name: name,
        lastStatus: Date.now()
    }

    const enter = {
        from: name,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: currentTime()
    }

    try {

        await userSchema.validateAsync(name, { abortEarly: false });
        const namesFound = await db.collection("participants").find({ name }).toArray();

        if (!namesFound.length) { //verifica se ja existe o nome
            await db.collection("participants").insertOne(participant);
            await db.collection("messages").insertOne(enter);
            res.sendStatus(201);
        } else {
            res.sendStatus(409)
        }

    } catch (e) {
        if (e.isJoi) {
            e.details.forEach(detail => console.log(textError(detail.message)))
            res.status(422).send(e.details.map(detail => detail.message))
        } else {
            console.log(e);
            res.sendStatus(404)
        }
    }

})

app.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray();
        res.send(participants).status(200);

    } catch (e) {
        console.log(e)
        res.sendStatus(500)

    }
})

app.get("/messages", async (req, res) => {
    const user = req.headers.user;
    const limit = parseInt(req.query.limit);

    try {
        const newUser = await userSchema.validateAsync(user, { abortEarly: false });
        const messages = await db.collection("messages").find({ $or: [{ $or: [{ to: newUser }, { to: 'Todos' }] }, { from: newUser }, { type: "message" }] }).toArray();

        if (limit) {
            res.send(messages.slice(-limit));
        } else {
            res.send(messages);
        }

    } catch (e) {
        if (e.isJoi) {
            e.details.forEach(detail => console.log(textError(detail.message)))
            res.status(422).send(e.details.map(detail => detail.message))
        } else {
            console.log(e);
            res.sendStatus(404)
        }
    }

})

app.post("/messages", async (req, res) => {
    const user = req.headers.user;
    const body = req.body;


    const bodySchema = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid("message", "private_message").required()
    })


    try {

        const newUser = await userSchema.validateAsync(user, { abortEarly: false });
        const { to, type, text } = await bodySchema.validateAsync(body, { abortEarly: false });

        const resultSearch = await db.collection("participants").findOne({ name: newUser });
        if (resultSearch === null) {
            res.sendStatus(404);
            return;
        }

        const message = {
            from: newUser,
            to,
            type,
            text,
            time: currentTime()
        }

        await db.collection("messages").insertOne(message);
        res.send(message);


    } catch (e) {
        if (e.isJoi) {
            e.details.forEach(detail => console.log(textError(detail.message)))
            res.status(422).send(e.details.map(detail => detail.message))
        } else {
            console.log(e);
            res.sendStatus(500)
        }
    }

})

app.post("/status", async (req, res) => {
    const user = req.headers.user;

    try {
        const newUser = await userSchema.validateAsync(user, { abortEarly: false });

        const search = await db.collection("participants").findOne({ name: newUser });
        if (!search) {
            res.sendStatus(404);
            return;
        }

        await db.collection("participants").updateOne(
            { name: newUser },
            { $set: { lastStatus: Date.now() } });

        res.sendStatus(200);

    } catch (e) {
        if (e.isJoi) {
            e.details.forEach(detail => console.log(textError(detail.message)))
            res.status(422).send(e.details.map(detail => detail.message))
        } else {
            console.log(e);
            res.sendStatus(500)
        }
    }
})

app.listen(5000, () => {
    console.log(chalk.bold.green("Server is running..."));
})

