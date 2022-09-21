const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { createTabs } = require('../utils/helpers')

const docusignControllers = {
  authPrompt: (req, res) => {
    ///////////////////////////////
    // 1. prompt user to sign in //
    ///////////////////////////////
    const authURL = `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature&client_id=${process.env.DOCUSIGN_CLIENT_ID}&state=${process.env.DOCUSIGN_SUPER_SECRET_STATE}&redirect_uri=${process.env.DOCUSIGN_AUTH_REDIRECT_URL}`
  
    res.redirect(authURL)
  },
  authCallback: async (req, res) => {
    console.log('2) Docusign authCallback running')
    if (req.query && req.query.code) {
      req.session.docusign = {}

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
  
        const { data: tokenInfo } = await axios.post(`https://account-d.docusign.com/oauth/token`, body, headers)
        const { token_type, access_token } = tokenInfo  
        console.log('Tokens received!')
        
        req.session.docusign.tokenInfo = tokenInfo
  
        /////////////////////
        // 3. get userinfo //
        /////////////////////
        headers = {
          headers: {
            'Authorization': `${token_type} ${access_token}` 
          }
        }
  
        req.session.docusign.headers = headers.headers

        const { data: userInfo } = await axios('https://account-d.docusign.com/oauth/userinfo', headers)
        
        console.log('UserInfo found!')
        req.session.docusign.userInfo = userInfo
  
        /////////////////////////////////////////////
        // 4. finally can make API calls, phew! :D //
        /////////////////////////////////////////////
        const account = userInfo.accounts.find(({ account_id }) => account_id === process.env.DOCUSIGN_ACCOUNT_ID)
        console.log("Account found!")

        const { account_id, base_uri } = account
        const apiBaseURL = `${base_uri}/restapi/v2.1/accounts/${account_id}`
        
        req.session.docusign.account = account
        req.session.docusign.apiBaseURL = apiBaseURL

        res.status(200).redirect('/')
      } catch (err) {
        console.log(err)
        res.status(500).end()
      }
    } else {
      res.status(401).send('401 Not Authorized')
    }
  },
  signout: (req, res) => {
    req.session.docusign = null
    res.redirect('/')
  },
  createEnvelope: async (req, res) => {
    const { embeddedSigning } = req.query

    if (!req.session || !req.session.docusign) {
      return res.status(401).redirect('/?status=error&message=No+docusign+session+found')
    }

    ////////////////////////////////////
    // Let's try creating an envelope //
    // with a signable html doc !!!!! //
    ////////////////////////////////////

    const { apiBaseURL, headers } = req.session.docusign

    var contentHtml = fs.readFileSync(path.join(__dirname, '..', 'utils', 'doc.html'), 'utf8');
    
    // // CREATE ENVELOPE
    const signers = [
      {
        name: "Zylo",
        email: "zylo.codes@gmail.com",
        clientUserId: embeddedSigning ? "zylocodes" : null, // exclude clientUserId to send via email
        recipientId: "1",
        routingOrder: "1"
      },
      {
        name: "8cto",
        email: "8ctopotamus@gmail.com",
        clientUserId: embeddedSigning ? "8ctopotamus" : null, // exclude clientUserId to send via email
        recipientId: "100",
        routingOrder: "1"
      },
    ]

    const envBody = {
      recipients: {
        signers,
      },
      status: "created",
      emailSubject: "Docusign Test!",
      emailBlurb: 'This is an auto-tag test',
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
    
    const { data: envelope } = await axios.post(`${apiBaseURL}/envelopes`, envBody, { headers })

    // UPLOAD NEW DOC HTML
    const envelopeId = envelope.envelopeId
    console.log(`Created Envelope ${envelopeId}`, envelope)

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
      { headers }
    )

    // ADD RECIPIENT TABS
    const tabs = createTabs(signers, contentHtml)      
    for (const signer of signers) {
      const { recipientId, clientUserId } = signer
      await axios.post(
        `${apiBaseURL}/envelopes/${envelopeId}/recipients/${recipientId}/tabs`, 
        tabs[recipientId], 
        { headers }
      )
      console.log(`${clientUserId}'s have been tabs added`)
    }

    // Send the envelope
    const { data } = await axios.put(`${apiBaseURL}/envelopes/${envelopeId}`, { status: 'sent' }, { headers })
    console.log(`Envelope ${data.envelopeId} sent!`, data)

    if (embeddedSigning) {
      // FOR EMBEDDED SIGNING
      let signerURLs = []
      for (const signer of signers) {
        // Create the recipient view definition
        const requestData = {
          returnUrl: "http://localhost:8080?status=success&message=Envelope+Signed!",
          authenticationMethod: "none",
          email: signer.email,
          userName: signer.name,
          clientUserId: signer.clientUserId,
        }
        const { data: { url } } = await axios.post(`${apiBaseURL}/envelopes/${envelopeId}/views/recipient`, requestData, { headers })
        signerURLs.push(url)
      }

      // res.status(200).redirect(signerURLs[0])

      req.session.docusign.signerURLs = signerURLs

      res.status(200).redirect(`/embeddedSigning`)
    } else {      
      res.status(200).redirect(`/?status=success&message=Envelope+${envelopeId}+sent`)
    }
  },
  getEmbeddedSiginingURL: (req, res) => {
    if (req.session?.docusign?.signerURLs) {
      res.json(req.session.docusign.signerURLs)
    } else {
      res.status(400).json({ error: 'No signerURLs found on session' })
    }
  }
}

module.exports = docusignControllers