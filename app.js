import express from "express";
import chalk from "chalk";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import Joi from "joi";
import { strict as assert } from "assert";
import { stripHtml } from "string-strip-html";


dotenv.config();
console.log()

const app = express();
app.use(cors());
app.use(express.json());


const currentTime = () => dayjs().format('HH:mm:ss');
const userSchema = Joi.string().min(1).required();
const textError = (text) => chalk.red(text)
const messageSchema = Joi.object({
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().valid("message", "private_message").required()
})

const leaveRoomMessage = (name) => {
    return {
        from: name,
        to: 'Todos',
        text: 'sai da sala...',
        type: 'status',
        time: currentTime()
    }
}

// conexão com o banco de dados
let db = null;
const mongoClient = new MongoClient(process.env.MONGO_URI);
mongoClient.connect()
    .then(() => {
        db = mongoClient.db(process.env.DB_NAME);
        console.log(chalk.blue.bold("Conectado no banco de dados"))
    })
    .catch(error => console.log(chalk.red.bold("Não foi possível conectar no banco de dados"), error));


//FIXME: aumentar a legibilidade do setInverval e deleteInative
setInterval(deleteInative, 15000)

async function deleteInative() {
    try {
        const allParticipants = await db.collection("participants").find({}).toArray();
        await allParticipants.forEach(async (participant) => {
            const { name, lastStatus } = participant;
            if (Date.now() - parseInt(lastStatus) >= 10000) {
                await db.collection("participants").deleteOne(participant);
                db.collection("messages").insertOne(leaveRoomMessage(name));
            }
        });
    } catch (e) {
        console.log(e);
    }
}


app.post("/participants", async (req, res) => {
    const name = stripHtml(req.body.name).result.trim()

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
            res.status(201).send({ name });
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
            return;
        } else {
            res.send(messages);
            return;
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

    try {

        const newUser = await userSchema.validateAsync(user, { abortEarly: false });
        const { to, type, text } = await messageSchema.validateAsync(body, { abortEarly: false });

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

app.delete("/messages/:idMessage", async (req, res) => {
    const { user } = req.headers;
    const { idMessage } = req.params;


    try {
        const messageFound = await db.collection("messages").findOne({ _id: new ObjectId(idMessage) });
        if (!messageFound) {
            res.sendStatus(404);
            return;
        }
        if (messageFound.from !== user) {
            res.sendStatus(401);
            return;
        }
        await db.collection("messages").deleteOne({ _id: new ObjectId(idMessage) });
        res.sendStatus(200);
    } catch (e) {
        res.sendStatus(500);
    }

})

app.put("/messages/:idMessage", async (req, res) => {
    const { idMessage } = req.params
    const { user: from } = req.headers
    const body = req.body;

    try {
        const { to, type, text } = await messageSchema.validateAsync(body, { abortEarly: false });
        const messageFound = await db.collection("messages").findOne({ _id: new ObjectId(idMessage) });
        if (!messageFound) {
            res.sendStatus(404);
            return;
        }
        if (messageFound.from !== from) {
            res.sendStatus(401);
            return;
        }
        await db.collection("messages").updateOne({ _id: new ObjectId(idMessage) }, {
            $set: {
                from,
                to,
                text,
                type
            }
        })
        res.sendStatus(200);

    } catch (e) {
        res.sendStatus(500);
    }

})



app.listen(5000, () => {
    console.log(chalk.bold.green("Server is running..."));
})

