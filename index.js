const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 3000;

// MongoDB
const { MongoClient, ServerApiVersion } = require("mongodb");

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.0ocgkty.mongodb.net/?appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

app.get("/", (req, res) => {
    res.send("Contest Hub Server is running");
});

async function run() {
    try {
        //connnect to the database
        const database = client.db(process.env.DB_NAME);

        //create a collection
        const contestCollection = database.collection("contests");

// ----------------- contest related api---------------------------        

        //get all contests api
        app.get("/contests", async (req, res) => {
            const query = {};
            const cursor = contestCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })


        //create a contest api
        app.post("/contests", async (req, res) => {
            const contest = req.body;
            console.log(contest);
            const result = await contestCollection.insertOne(contest);
            res.send(result);
        });

        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Contest Hub Server is running on port ${port}`);
});
