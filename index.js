const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 3000;

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// MongoDB
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
        const userCollection = database.collection("users");
        const contestCollection = database.collection("contests");
        const paymentCollection = database.collection("payments");
        const contestEntryCollection = database.collection("contestEntries");

        // -------------------- User related api---------------------------

        //get all users api
        app.get("/users", async (req, res) => {
            const cursor = userCollection.find().sort({ createdAt: -1 });
            const result = await cursor.toArray();
            res.send(result);
        });

        //get a user by his email
        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        });

        //create a user api
        app.post("/users", async (req, res) => {
            const user = req.body;
            user.role = "user"; // default role
            user.createdAt = new Date();

            //check if user already exists. if exists, do not insert again
            const email = user.email;
            const userExists = await userCollection.findOne({ email });
            if (userExists) {
                return res.send({ message: "User already exists" });
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        //update user data api by email
        app.patch("/users", async (req, res) => {
            const { email } = req.query;
            const updatedData = req.body;
            const filter = { email };
            const updateDoc = {
                $set: {
                    ...updatedData,
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // Update user role
        app.patch("/users/:id/role", async (req, res) => {
            const { id } = req.params;
            const { role } = req.body;

            if (!["user", "creator", "admin"].includes(role)) {
                return res.status(400).send({ message: "Invalid role" });
            }

            const result = await userCollection.updateOne({ _id: new ObjectId(id) }, { $set: { role } });

            res.send(result);
        });

        // ----------------- contest related api---------------------------

        //get all contests api
        app.get("/contests", async (req, res) => {
            const query = {};
            const { email } = req.query;
            if (email) {
                query.creatorEmail = email;
            }

            const options = {
                // sort by createdAt in descending order
                sort: { createdAt: -1 },
            };

            const cursor = contestCollection.find(query, options);
            const result = await cursor.toArray();
            res.send(result);
        });

        //get 8 popular contest api
        app.get("/contests/popular", async (req, res) => {
            const now = new Date();
            const result = await contestCollection
                .find({ deadline: { $gt: now }, approvalStatus: "approved" })
                .sort({
                    participants: -1,
                    createdAt: -1,
                })
                .limit(8)
                .toArray();
            res.send(result);
        });

        //get a single contest api
        app.get("/contests/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await contestCollection.findOne(query);
            res.send(result);
        });

        //create a contest api
        app.post("/contests", async (req, res) => {
            const contest = req.body;
            contest.createdAt = new Date();

            // Convert deadline string to Date
            if (contest.deadline) {
                contest.deadline = new Date(contest.deadline);
            }

            const result = await contestCollection.insertOne(contest);
            res.send(result);
        });

        //update a contest api(admin)
        app.patch("/contests/:id", async (req, res) => {
            const id = req.params.id;
            const { approvalStatus , winner } = req.body;
            const query = { _id: new ObjectId(id) };

            const updatedFields = {};

            if (approvalStatus !== undefined) updatedFields.approvalStatus = approvalStatus;
            if (winner) {
                updatedFields.winner = winner;
            }

            const updatedDoc = {
                $set: updatedFields,
            };

            const result = await contestCollection.updateOne(query, updatedDoc);
            res.send(result);
        });

        // update contest info (creator)
        app.patch("/contests/edit/:id", async (req, res) => {
            const id = req.params.id;
            const data = req.body;

            delete data.approvalStatus;

            const result = await contestCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        ...data,
                        updatedAt: new Date(),
                    },
                }
            );

            res.send(result);
        });

        // Delete a contest api
        app.delete("/contests/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await contestCollection.deleteOne(query);
            res.send(result);
        });

        //================================contest entry collection related api=========================================

        // My participated contests
        app.get("/my-participated-contests", async (req, res) => {
            const { email } = req.query;

            // Get all paid contests by user
            const payments = await paymentCollection.find({ userEmail: email, status: "paid" }).sort({ createdAt: -1 }).toArray();

            res.send(payments);
        });

        // Check if a user already registered in a contest
        app.get("/contest-registered", async (req, res) => {
            const { contestId, email } = req.query;

            const payment = await paymentCollection.findOne({
                contestId,
                userEmail: email,
                status: "paid",
            });

            res.send({
                registered: !!payment,
            });
        });

        //submit task api
        app.patch("/submit-task", async (req, res) => {
            const { contestId, email, task } = req.body;

            const filter = {
                contestId: contestId,
                userEmail: email,
            };

            const updateDoc = {
                $set: {
                    submittedTask: task,
                    submittedAt: new Date(),
                },
            };

            const result = await contestEntryCollection.updateOne(filter, updateDoc);

            if (result.matchedCount === 0) {
                return res.status(404).send({ success: false, message: "No contest entry found for this user" });
            }

            res.send({ success: true, message: "Task submitted successfully" });
        });

        // Get user's contest entry (for submission status)
        app.get("/contest-entry", async (req, res) => {
            const { contestId, email } = req.query;

            const entry = await contestEntryCollection.findOne({
                contestId,
                userEmail: email,
            });

            res.send(entry || {});
        });

        // Get all registered users for a contest
        app.get("/contest-registrations/:contestId", async (req, res) => {
            const { contestId } = req.params;

            const submissions = await contestEntryCollection
                .find({
                    contestId: contestId,
                })
                .sort({ submittedAt: -1 })
                .toArray();

            res.send(submissions);
        });

        // -----------------payment related api---------------------------

        //create payment api

        app.post("/create-checkout-session", async (req, res) => {
            const paymentInfo = req.body;

            // Check if already paid
            const alreadyPaid = await paymentCollection.findOne({
                userEmail: paymentInfo.userEmail,
                contestId: paymentInfo.contestId,
                status: "paid",
            });

            if (alreadyPaid) {
                return res.status(400).send({
                    message: "You have already registered for this contest",
                });
            }

            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: "USD",
                            unit_amount: parseInt(paymentInfo.entryPrice * 100), // amount in cents
                            product_data: {
                                name: paymentInfo.contestName,
                            },
                        },
                        quantity: 1,
                    },
                ],
                customer_email: paymentInfo.userEmail,
                mode: "payment",
                metadata: {
                    contestId: paymentInfo.contestId,
                    contestName: paymentInfo.contestName,
                    participantName: paymentInfo.userName,
                },
                success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/payment-cancel/${paymentInfo.contestId}`,
            });
            res.send({ url: session.url });
        });

        app.patch("/payment-success", async (req, res) => {
            const { session_id } = req.query;

            try {
                // Retrieve Stripe session
                const session = await stripe.checkout.sessions.retrieve(session_id);

                if (session.payment_status !== "paid") {
                    return res.status(400).send({ success: false, message: "Payment not completed" });
                }

                // Prevent duplicate processing
                const existingPayment = await paymentCollection.findOne({ sessionId: session.id });
                if (existingPayment) {
                    return res.send({ success: true, message: "Payment already processed" });
                }

                const contestId = session.metadata.contestId;

                // Increment participants count
                await contestCollection.updateOne({ _id: new ObjectId(contestId) }, { $inc: { participants: 1 } });

                // Save payment info
                await paymentCollection.insertOne({
                    sessionId: session.id,
                    userEmail: session.customer_email,
                    contestId: contestId,
                    contestName: session.metadata.contestName,
                    amount: session.amount_total / 100,
                    currency: session.currency,
                    status: session.payment_status,
                    createdAt: new Date(),
                    transactionId: session.payment_intent,
                });

                // Save participant info
                await contestEntryCollection.insertOne({
                    contestId: contestId,
                    participantName: session.metadata.participantName,
                    userEmail: session.customer_email,
                    joinedAt: new Date(),
                    sessionId: session.id,
                    status: "confirmed",
                });

                res.send({ success: true, message: "Payment processed and participants count updated", transactionId: session.payment_intent });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: "Server error" });
            }
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
