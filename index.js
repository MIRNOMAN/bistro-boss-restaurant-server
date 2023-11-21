const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lyzjy.mongodb.net/?retryWrites=true&w=majority`;

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
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
  const  usersCollection = client.db('bistroDB').collection('users');
   const menuCollection = client.db('bistroDB').collection('menu')
   const reviewsCollection = client.db('bistroDB').collection('reviews')
   const CartCollection = client.db('bistroDB').collection('carts')
   const paymentCollection = client.db('bistroDB').collection('payments')

// jwt token

app.post('/jwt', async(req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN, {expiresIn: '1h'});
  res.send({token});
})

// middleware
const verifyToken = (req, res, next) => {
  console.log('inside verifyToken', req.headers.authorization);
  if(!req.headers.authorization){
    return res.status(401).send({message: 'unauthorize access'});
  }
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token,process.env.ACCESS_TOKEN, (err, decoded) =>{
   if(err){
    return res.status(401).send({message: 'unauthorize access'});
   }
   req.decoded = decoded;
   next();
  })
 
}

const veryfyAdmin = async(req, res, next) =>{
   const email = req.decoded.email;
   const query = {email: email}
   const user = await usersCollection.findOne(query);
   const isAdmin = user?.role === 'admin';
   if(!isAdmin){
    return res.status(403).send({message: 'forbidden access'});
   }
   next();
}

// admin user
app.get('/users',verifyToken,veryfyAdmin, async(req, res) => {
  const result = await usersCollection.find().toArray();
  res.send(result);
})

app.get('/user/admin/:email',verifyToken, async(req, res) => {
  const email = req.params.email;
  if(email !== req.decoded.email) {
    return res.status(403).send({message: 'forbidden access'})
  }
  const query = {email: email};
  const user = await usersCollection.findOne(query);
  let admin = false;
  if(user){
    admin = user?.role === 'admin';
  }
  res.send({admin})

})
app.post('/users', async (req, res) => {
  // insert email if you doesN't exist:
  // you can do this many ways (1. email unique 2. upsert 3. simple checking)
  
  const user = req.body;
  const query = {email: user.email}
  const existingUser = await usersCollection.findOne(query);
  if(existingUser){
    return res.send({success: 'user already exists', insertId: null})
  }
  const result = await usersCollection.insertOne(user);
  res.send(result);
})

app.patch('/users/admin/:id',verifyToken,veryfyAdmin, async(req, res) => {
  const id = req.params.id;
  const filter = {_id: new ObjectId(id)};
  const updatedDoc = {
    $set: {
      role: 'admin',
    }
  }
  const result = await usersCollection.updateOne(filter, updatedDoc);
  res.send(result);
})

app.delete('/users/:id',verifyToken,veryfyAdmin, async (req, res) => {
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await usersCollection.deleteOne(query);
  res.send(result);
})


// menu related api

app.get('/menu', async(req, res) => {
    const result = await menuCollection.find().toArray();
    res.send(result);
})

app.get('/menu/:id',async(req, res) => {
   const id = req.params.id;
   const query = {_id: id};
   const result = await menuCollection.findOne(query);
   res.send(result);
})

app.post('/menu',verifyToken,veryfyAdmin,  async(req, res) => {
  const item = req.body;
  const result = await menuCollection.insertOne(item);
  res.send(result);
})

app.patch('/menu/:id', async(req,res) =>{
  const item = req.body;
  const id = req.params.id;
  const filter = {_id : id};
  const updateDoc ={
    $set: {
      name: item.name,
      category: item.category,
      price : item.price,
      recipe: item.recipe,
      image: item.image,

    }
  }
  const result = await menuCollection.updateOne(filter, updateDoc);
  res.send(result);
})

app.delete('/menu/:id',verifyToken,veryfyAdmin, async(req, res) => {
  const id = req.params.id;
  const query = {_id: id};
  const result = await menuCollection.deleteOne(query);
  res.send(result);
})



app.get('/reviews', async(req, res) => {
  const result = await reviewsCollection.find().toArray();
  res.send(result);
})

// cart section
app.get('/carts', async(req, res) => {
  const email = req.query.email;
  const query = {email: email};
  const result = await CartCollection.find(query).toArray();
  res.send(result);
})


app.post('/carts', async(req, res) =>{
  const cartItem = req.body;
  const result = await CartCollection.insertOne(cartItem);
  res.send(result);
})

app.delete('/carts/:id', async(req, res) =>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await CartCollection.deleteOne(query);
  res.send(result);
})


// payment intent

app.post('/create-payment-intent', async (req, res) => {
 const {price} = req.body;
 const amount = parseInt(price * 100);

 const paymentIntent = await stripe.paymentIntents.create({
  amount: amount,
  currency: 'usd',
  payment_method_types: ['card'],

 })
 res.send({
  clientSecret: paymentIntent.client_secret
 })
})

app.get('/payments/:email', verifyToken, async (req, res) => {
  const query = {email: req.params.email}
  if(req.params.email !== req.decoded.email) {
    return res.status(403).send({message: 'forbidden access'})
  }

  const result = await paymentCollection.find(query).toArray();
  res.send(result);
})

app.post('/payments', async (req, res) =>{
  const payment = req.body;
  const paymentResult = await paymentCollection.insertOne(payment)

  console.log('payment info', payment)

  const query = {_id: {
    $in: payment.cartIds.map(id => new ObjectId(id)),
  }}

  const deleteResult = await paymentCollection.deleteMany(query)

  res.send({paymentResult, deleteResult})
})


app.get('/admin-stats',verifyToken,veryfyAdmin, async (req, res) =>{
  const users = await usersCollection.estimatedDocumentCount();
  const menuItems = await menuCollection.estimatedDocumentCount();
  const orders = await paymentCollection.estimatedDocumentCount();


  const result = await paymentCollection.aggregate([
    {
      $group:{
        _id: null,
        totalRevenue: {
          $sum: '$price',
        }
      }
    }
  ]).toArray();

  const revenue = result.length > 0 ? result[0].totalRevenue : 0;

  res.send({users, menuItems, orders,revenue})

})

// using aggregated pipeline

app.get('/order-stats',verifyToken,veryfyAdmin, async(req, res) =>{
  const result = await paymentCollection.aggregate([
    {
      $unwind: '$menuItemIds',
    },
    {
      $lookup: {
        from: 'menu',
        localField: 'menuItemIds',
        foreignField: '_id',
        as: 'menuItems'
      }
    },
    {
      $unwind: '$menuItems',
    },
    {
      $group: {
        _id: '$menuItems.category',
        quantity: {
          $sum: 1
        },
        revenue: {
          $sum: '$menuItems.price'
        }
      }
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        quantity: '$quantity',
        revenue: '$revenue',

      }
    }
  ]).toArray();

  res.send(result)
})




    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('Bistro Boss')
  })
  
  app.listen(port, () => {
    console.log(`Bistro Boss listening on port ${port}`)
  })