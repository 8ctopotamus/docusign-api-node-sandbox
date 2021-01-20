require('dotenv').config()
const axios = require('axios')
const express = require("express")

const app = express()
const PORT = process.env.PORT || 8080

app.use(express.urlencoded({ extended: true }))
app.use(express.json())



// play with phantom js









app.get('/', (req, res) => {
  ///////////////////////////////
  // 1. prompt user to sign in //
  ///////////////////////////////
  const authURL = `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature&client_id=${process.env.DOCUSIGN_CLIENT_ID}&state=${process.env.DOCUSIGN_SUPER_SECRET_STATE}&redirect_uri=${process.env.DOCUSIGN_AUTH_REDIRECT_URL}`

  res.redirect(authURL)
})

app.get('/authorization-code/callback', async (req, res) => {
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

      const { data: { token_type, access_token } } = await axios.post(`https://account-d.docusign.com/oauth/token`, body, headers)

      
      /////////////////////
      // 3. get userinfo //
      /////////////////////
      headers = {
        headers: {
          'Authorization': `${token_type} ${access_token}` 
        }
      }

      const { data: userInfo } = await axios('https://account-d.docusign.com/oauth/userinfo', headers)
      
      /////////////////////////////////////////////
      // 4. finally can make API calls, phew! :D //
      /////////////////////////////////////////////
      const { account_id, base_uri } = userInfo.accounts.find(({ account_id }) => account_id === process.env.DOCUSIGN_ACCOUNT_ID)
      const apiBaseURL = `${base_uri}/restapi/v2.1/accounts/${account_id}`
      
      ////////////////////////////////////
      // Let's try creating an envelope //
      ////////////////////////////////////
      const envBody = {
        recipients: {
          "signers": [
            {
              "tabs": {
                "signHereTabs": [
                  {
                    "stampType": "signature",
                    "name": "SignHere",
                    "tabLabel": "signatureTab",
                    "scaleValue": "1",
                    "optional": "false",
                    "documentId": "1",
                    "recipientId": "1",
                    "pageNumber": "1",
                    "xPosition": "73",
                    "yPosition": "440"
                  }
                ]
              },
              "name": "Example J Simpson",
              "email": "zylo.codes@gmail.com",
              "clientUserId": "zylo.codes@gmail.com",
              "recipientId": "1",
              "routingOrder": "1"
            }
          ]
        },
        "status": "created",
        "emailSubject": "Example Signing Document",
        emailBlurb: 'Hey, testing!',
        documents: [
          {
            htmlDefinition: {
              source: "<html><body><div>Example HTML page source</div></body></html>"
            },
            documentId: "1",
            name: "doc1.html"
          }
        ]
      }
      
      const { data: envelope } = await axios.post(`${apiBaseURL}/envelopes`, envBody, headers)
      
      res.json(envelope)

      res.end()
    } catch (err) {
      console.log(err)
      res.status(500).end()
    }
  } else {
    res.status(401).send('401 Not Authorized')
  }
})

app.listen(PORT, function() {
  console.log("App listening on PORT: " + PORT)
})
