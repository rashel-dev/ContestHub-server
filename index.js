const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 3000;


// Middlewares
app.use(cors());
app.use(express.json());


app.get("/", (req, res) => {
    res.send("Contest Hub Server is running");
});

app.listen(port, () => {
    console.log(`Contest Hub Server is running on port ${port}`);
});
