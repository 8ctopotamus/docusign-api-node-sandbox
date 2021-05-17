// https://developers.docusign.com/platform/auth/authcode/authcode-get-token/

require('dotenv').config()
const fs = require('fs')
const axios = require('axios')
const express = require("express");
var session = require('express-session');
const mongoose = require('mongoose');
const Puppeteer = require('puppeteer');
const pdf = require('html-pdf');

mongoose.connect('mongodb://localhost:27017/docusign_sandbox', {useNewUrlParser: true, useUnifiedTopology: true});

const app = express()
const PORT = process.env.PORT || 8080

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.set('trust proxy', 1)
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}))

const createTabs = async contentHtml => {
  const browser = await Puppeteer.launch({headless:false});
  const page = await browser.newPage();
  await page.setViewport({ ...page.viewport(), width: 612 })
  await page.setContent(contentHtml);

  const elsToFind = [
    'ds-signature', 
    'ds-initial',
    'ds-date-signed',
    'input[data-ds-type="ssn"]',
    'input[data-ds-type="text"]' 
  ].join(', ')

  let tabs = await page.$$eval(elsToFind, els => els.map(el => {
    const { top, left, bottom, right } = el.getBoundingClientRect()
    let type = el.getAttribute('data-ds-type') || el.tagName.toLocaleLowerCase()
    let name = type.includes('ds') 
      ? type.replace('ds-', '').split('-').map(str => `${str.charAt(0).toUpperCase()}${str.slice(1)}`).join(' ') 
      : type
    if (name === 'ssn') name = name.toUpperCase()
    name = `${name}`
    
    if (type === 'ds-signature') {
      type = 'signHere'
    } else if (type === 'ds-initial') {
      type = 'initialHere'
    } else {
      type = type.split('-')
        .filter(str => str !== 'ds')
        .map((str, i) => i === 0 ? str : `${str.charAt(0).toUpperCase()}${str.slice(1)}`)
        .join('')
    }
    type = `${type}Tabs`
    return {
      name,
      coords: { top, left, bottom, right }, 
      role: el.getAttribute('data-ds-role'),
      recipientId: String(el.getAttribute('data-ds-recipient-id')), 
      required: el.required, 
      type,
    }
  }))
  
  const pageHeight = 792
  tabs = tabs.reduce((prev, curr) => {
    const { recipientId, type, coords, required, name } = curr
    const xPosition = Math.floor(coords.left)
    const y = Math.floor(coords.top)
    // const pageNumber = Math.floor(pageHeight / y) + 1
    // console.log(y, pageNumber)
    // const yPosition = (pageHeight * pageNumber - y) * -1
    // console.log(yPosition)
    
    const pageNumber = Math.ceil(y/pageHeight) 
    const difference = (pageHeight * pageNumber) - y 
    yPosition = pageHeight - difference

    const tab = {
      recipientId,
      name,
      optional: !required,
      documentId: "2",
      pageNumber,
      xPosition,
      yPosition
    }
    console.log(tab)
    if (prev[recipientId]) {
      if (prev[recipientId][type]) {
        prev[recipientId][type].push(tab)
      } else {
        prev[recipientId][type] = [tab]
      }
    } else {
      prev[recipientId] = { [type]: [tab] }
    }
    return prev
  }, {})

  await browser.close();
  return tabs
}



app.get('/', (req, res) => {
  ///////////////////////////////
  // 1. prompt user to sign in //
  ///////////////////////////////
  const authURL = `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature&client_id=${process.env.DOCUSIGN_CLIENT_ID}&state=${process.env.DOCUSIGN_SUPER_SECRET_STATE}&redirect_uri=${process.env.DOCUSIGN_AUTH_REDIRECT_URL}`

  res.redirect(authURL)
})

app.get('/authorization-code/callback', async (req, res) => {
  console.log('2) Docusign authCallback running')
  if (req.query && req.query.code) {
    try {
      ////////////////////////
      // 2. get oAuth token //
      ////////////////////////
      const idPass64 = Buffer
        .from(`${process.env.DOCUSIGN_CLIENT_ID}:${process.env.DOCUSIGN_CLIENT_SECRET}`)
        .toString('base64') 

      let headers = { 
        headers: { 
          'Authorization': `Basic ${idPass64}` 
        },
      }

      const body = {
        grant_type: 'authorization_code',
        code: req.query.code
      }

      const { data: { token_type, access_token, refresh_token } } = await axios.post(`https://account-d.docusign.com/oauth/token`, body, headers)

      console.log('Tokens received.')
      // console.log(refresh_token)

      /////////////////////
      // 3. get userinfo //
      /////////////////////
      headers = {
        headers: {
          'Authorization': `${token_type} ${access_token}` 
        }
      }

      const { data: userInfo } = await axios('https://account-d.docusign.com/oauth/userinfo', headers)
      
      console.log('UserInfo', userInfo)

      /////////////////////////////////////////////
      // 4. finally can make API calls, phew! :D //
      /////////////////////////////////////////////
      const { account_id, base_uri } = userInfo.accounts.find(({ account_id }) => account_id === process.env.DOCUSIGN_ACCOUNT_ID)
      const apiBaseURL = `${base_uri}/restapi/v2.1/accounts/${account_id}`

      ////////////////////////////////////
      // Let's try creating an envelope //
      // with a signable html doc !!!!! //
      ////////////////////////////////////
      var contentHtml = fs.readFileSync('./index.html', 'utf8');
      
      // CREATE ENVELOPE
      const signers = [
        {
          name: "Zylo",
          email: "zylo.codes@gmail.com",
          clientUserId: "zylo.codes@gmail.com",
          recipientId: "1",
          routingOrder: "1"
        }
      ]

      const envBody = {
        recipients: {
          signers,
        },
        status: "created",
        emailSubject: "Example Signing Document",
        emailBlurb: 'Hey, testing!',
        documents: [
          {
            htmlDefinition: {
              source: '<h1>COVER PAGE</h1><p>Ignore me...</p>'
            },
            documentId: "1",
            name: "doc1.html"
          }
        ]
      }
      
      const { data: envelope } = await axios.post(`${apiBaseURL}/envelopes`, envBody, headers)
      console.log('NEW Envelope', envelope)
      
      // UPLOAD NEW DOC HTML
      const envelopeId = envelope.envelopeId
      
      const { data: updatedDoc } = await axios.put(
        `${apiBaseURL}/envelopes/${envelopeId}/documents`, 
        {
          documents: [
            {
              htmlDefinition: {
                source: contentHtml,
              },
              documentId: "2",
              name: "doc02.html"
            }
          ]
        }, 
        headers
      )
      console.log('updatedDoc')
      console.log(updatedDoc)

      // ADD RECIPIENT TABS
      const tabs = await createTabs(contentHtml)
      console.log(tabs)
      for (const signer of signers) {
        const { recipientId } = signer
        const { data: updatedRecipientTabs } = await axios.post(
          `${apiBaseURL}/envelopes/${envelopeId}/recipients/${recipientId}/tabs`, 
          tabs[recipientId], 
          headers
        )
        console.log('updatedRecipientTabs', JSON.stringify(updatedRecipientTabs, null, 2))
      }
      console.log('done')

      res.status(200).end()
    } catch (err) {
      console.log(err)
      res.status(500).end()
    }
  } else {
    res.status(401).send('401 Not Authorized')
  }
})

app.listen(PORT, function() {
  console.log("App listening on http://localhost:" + PORT)
})
