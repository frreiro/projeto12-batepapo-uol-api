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


// conexão com o banco de dados
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db = null;



//TODO: Validações de erros
app.post("/participants", async (req, res) => {
    const { name } = req.body

    const nameSchema = Joi.object({
        name: Joi.string().alphanum().min(3).required()
    })


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
        await mongoClient.connect();
        db = mongoClient.db("test");

        const objectValidated = await nameSchema.validateAsync({ name: name }) //valida se a string não ta vazia
        const namesFound = await db.collection("participants").find(objectValidated).toArray();

        if (!namesFound.length) { //verifica se ja existe o nome
            await db.collection("participants").insertOne(participant);
            await db.collection("messages").insertOne(enter);
            res.sendStatus(201);
        } else {
            res.sendStatus(409)
        }
        mongoClient.close();


    } catch (e) {
        console.log(e);
        res.sendStatus(404)

        mongoClient.close();
    }

})

app.get("/participants", async (req, res) => {
    try {
        await mongoClient.connect();
        db = mongoClient.db("test");

        const participants = await db.collection("participants").find().toArray();
        res.send(participants).status(200);

        mongoClient.close()

    } catch (e) {
        console.log(e)
        res.sendStatus(500)

        mongoClient.close()
    }
})
// FIXME: mensagens possivelmente enviadas ao contrário
app.get("/messages", async (req, res) => {
    const user = req.headers.user;
    const limit = parseInt(req.query.limit);

    try {
        await mongoClient.connect();
        db = mongoClient.db("test");

        const newUser = await userSchema.validateAsync(user);
        const messages = await db.collection("messages").find({ $or: [{ to: newUser }, { from: newUser }, { type: "message" }] }).toArray();

        if (limit) {
            res.send(messages.slice(-limit));
        } else {
            res.send(messages);
        }
        mongoClient.close();

    } catch (e) {
        console.log(e);
        res.sendStatus(404);
        mongoClient.close();
    }

})

app.post("/messages", async (req, res) => {
    const user = req.headers.user;
    const body = req.body;


    const bodySchema = Joi.object({
        to: Joi.string().min(3).required(),
        text: Joi.string().min(3).required(),
        type: Joi.string().valid("message", "private_message").required()
    })


    try {
        await mongoClient.connect();
        db = mongoClient.db("test");

        const newUser = await userSchema.validateAsync(user);
        const { to, type, text } = await bodySchema.validateAsync(body);

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

        mongoClient.close()

    } catch (e) {
        console.log(e);
        res.send(500);

        mongoClient.close();

    }

})
//TODO: Validar se o usuário não consta na lista
//TODO: Atualizar o lastStatus do usuário.
app.post("/status", async (req, res) => {
    const user = req.headers.user;

})

app.listen(5000, () => {
    console.log(chalk.bold.green("Server is running..."));
})

