import express from "express";
import chalk from "chalk";
import cors from "cors"

const app = express();
app.use(cors());
app.use(express.json());

app.get("/participants", (req, res) => { })

app.post("/participants", (req, res) => { })

app.get("/messages", (req, res) => { })

app.post("/messages", (req, res) => { })

app.post("/status", (req, res) => { })

app.listen(5000, () => {
    console.log(chalk.bold.green("Server is running..."));
})