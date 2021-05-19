// https://developers.docusign.com/platform/auth/authcode/authcode-get-token/

require('dotenv').config()
const fs = require('fs')
const axios = require('axios')
const express = require("express");
const Puppeteer = require('puppeteer');
const pdf = require('html-pdf');

const app = express()
const PORT = process.env.PORT || 8080

app.use(express.urlencoded({ extended: true }))
app.use(express.json())


const createTabs = () => {
  const contentHtml = fs.readFileSync('./index.html', 'utf8');
  const signers = [
    {
      name: "Zylo",
      email: "zylo.codes@gmail.com",
      clientUserId: "zylo.codes@gmail.com",
      recipientId: "1",
      routingOrder: "1"
    },
    // {
    //   name: "Zylo",
    //   email: "zylo.codes@gmail.com",
    //   clientUserId: "zylo.codes@gmail.com",
    //   recipientId: "2",
    //   routingOrder: "1"
    // },
    // {
    //   name: "Zylo",
    //   email: "zylo.codes@gmail.com",
    //   clientUserId: "zylo.codes@gmail.com",
    //   recipientId: "100",
    //   routingOrder: "1"
    // },
  ]
  const placeholders = contentHtml.match(/(?<=\[\[)(.*?)(?=\]\])/g)
  if (!placeholders || placeholders.length === 0) 
    return false

  const tabs = {}
  signers.forEach(({ recipientId }) => {
    tabs[recipientId] = placeholders
      .map(p => {
        const [ type, role, id ] = p.split('_')
        return { type, role, id }
      })
      .reduce((prev, curr) => {
        const { type, role, id } = curr
        const key = `${type}Tabs`
        if(!prev[key] && id === recipientId) {
          prev[key] = [
            {
              "anchorString": `[[${[ type, role, id ].join('_')}]]`,
              "anchorXOffset": "0",
              "anchorYOffset": "0",
              "anchorIgnoreIfNotPresent": "false",
              "anchorUnits": "pixels",
              recipientId,
              "documentId": "2"
            }
          ]
        }
        return prev
      } , {})
  })
  return tabs
}

createTabs()

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
      const tabs = createTabs(contentHtml)      
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
