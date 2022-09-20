require('dotenv').config()

const path = require('path')
const express = require("express");
const session = require('express-session')
const { engine } = require('express-handlebars')
const routes = require('./routes')

const PORT = process.env.PORT || 8080

const sess = {
  secret: 'secretsSecretsAreNoFun',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production'
  }
}

const app = express()
  .engine('handlebars', engine())
  .set('view engine', 'handlebars')
  .set('views', './views')
  .use(express.static(path.join(__dirname, 'public')))
  .use(express.urlencoded({ extended: true }))
  .use(express.json())
  .use(session(sess))
  .use(routes)

app.listen(PORT, () => console.log(`App listening at http://localhost:${PORT}`))
