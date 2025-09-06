require('dotenv').config()
const express = require('express');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
var jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
app.use(express.json())
app.use(cors())

// mongodb setup///
const uri = `mongodb+srv://${process.env.MEDIMART_USER}:${process.env.MEDIMART_PASS}@cluster0.phy8j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster01`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const database = client.db("MediMart");
    const usersCollection = database.collection("users");
    const categoryCollection = database.collection("category");
    const advertisementCollection = database.collection("advertisement");
    const medicineCollection = database.collection("medicine");
    const cartsCollection = database.collection("carts");
    const paymentCollection = database.collection("payments");
    const articlesCollection = database.collection("articles");

    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '30d' })
      res.send({ token });
    })

    const verifyToken = (req, res, next) => {
      console.log("Headers received:", req.headers); // Check headers

      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" })
      }

      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" })
        }
        req.decoded = decoded
        next()
      });

    }

      const verifyAdmin = async (req, res, next) => {
      const userEmail = req.decoded.email
      console.log(req.decoded, "decoded");
      const query = { userEmail: userEmail }
      console.log(query, "query");
      const user = await usersCollection.findOne(query)
      console.log(user, "user");
      const isAdmin = user?.userRole === "Admin"
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" })
      }
      next()
    }


     app.post('/users', async (req, res) => {
      const usersBody = req.body
      // new up
      const query = { userEmail: usersBody.userEmail }
      const existingUser = await usersCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      // new up
      const result = await usersCollection.insertOne(usersBody)
      res.send(result)
    })

     app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    app.get('/users/role/:email', async (req, res) => {
      const userEmail = req.params.email
      const query = { userEmail }
      const result = await usersCollection.findOne(query)
      res.send({ userRole: result?.userRole })
    })

    
    // user role update//
    app.patch('/users/role/:email', verifyToken, verifyAdmin, async (req, res) => {
      const userEmail = req.params.email
      const { userRole } = req.body
      const filter = { userEmail }
      updateDoc = {
        $set: { userRole },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

 //  my profile user show//

    app.put('/myprofile/:email', async (req, res) => {
      const email = req.params.email;
      const filter = { userEmail: email };
      const updateProfile = req.body;

      const updateDoc = {
        $set: {
          ...(updateProfile.userName && { userName: updateProfile.userName }),
          ...(updateProfile.userphoto && { userphoto: updateProfile.userphoto }),
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //  users delete/
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result)
    })

    // category//

    app.get('/category', async (req, res) => {
      try {
        const categories = await categoryCollection.find().toArray();
        const categoryWithCount = await Promise.all(categories.map(async (category) => {
          const productCount = await medicineCollection.countDocuments({ medicineCategory: category.categoryName });
          return { ...category, productCount };
        }));

        res.send(categoryWithCount);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching data' });
      }
    });

     app.post('/category', verifyToken, verifyAdmin, async (req, res) => {
      const categoryBody = req.body
      const result = await categoryCollection.insertOne(categoryBody)
      res.send(result)
    })

    //  category update
    app.put('/category/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updateCategory = req.body
      const updateDoc = {
        $set: {
          categoryName: updateCategory.categoryName,
          categoryImage: updateCategory.categoryImage,
        }
      }
      const result = await categoryCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    //  category delete/
    app.delete("/category/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) };
      const result = await categoryCollection.deleteOne(query);
      res.send(result)
    })

     //  .............advertisement ////////////


    app.get('/advertisement', verifyToken, async (req, res) => {
      const result = await advertisementCollection.find().toArray()
      res.send(result)
    })

     app.get('/seller-advertisement/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { requestEmail: email }
      const result = await advertisementCollection.find(query).toArray()
      res.send(result)
    })

       app.get('/acceptad-advertisement', async (req, res) => {
      try {
        const result = await advertisementCollection
          .find({ advertisementStatus: "Accept" })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching advertisements:", error);
        res.status(500).send({ error: "Failed to fetch advertisements" });
      }
    });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send("MediMart Website make ...")
})

app.listen(port, () => {
  console.log("Server Runnig", port);
})
