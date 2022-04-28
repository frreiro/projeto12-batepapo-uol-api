import express from "express";
import chalk from "chalk";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";

dotenv.config();

console.log()

const app = express();
app.use(cors());
app.use(express.json());


const currentTime = () => dayjs().format('HH:mm:ss');


// conexão com o banco de dados
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db = null;



//TODO: validar nomes iguais 
// TODO: Fazer validações do body com o JOI
//TODO: Validações de erros
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
        await mongoClient.connect();
        db = mongoClient.db("test");

        await db.collection("participants").insertOne(participant);
        await db.collection("messages").insertOne(enter);
        res.sendStatus(201);

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

app.get("/messages", async (req, res) => {
})

//TODO: validar o body e headers
app.post("/messages", async (req, res) => {
    const user = req.headers.user;
    const { to, type, text } = req.body;

    const message = {
        from: user,
        to,
        type,
        text,
        time: currentTime()
    }

    try {
        await mongoClient.connect();
        db = mongoClient.db("test");

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

