const express = require('express')
const routes = require('./router')
const connectDB = require('./DBconnect')
const session = require('express-session');


connectDB()



const app = express();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
        secure: false, 
        maxAge: 1000 * 60 * 60 
    }
}));







app.use(routes)

app.use(express.static('public'))



app.listen(process.env.PORT, () => {
  console.log('Server is running on port  http://localhost:3000')
})
